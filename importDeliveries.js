const XLSX = require('xlsx');
const path = require('path');
const sequelize = require('./src/config/database');
const Family = require('./src/models/family.model');
const Delivery = require('./src/models/delivery.model');
const User = require('./src/models/user.model');

const EXCEL_FILE_NAME = 'Listado General.xlsx'; 
const NOMBRE_HOJA_PADRON = 'Listado'; 

function extraerFecha(sheetName) {
  let nombreLimpio = sheetName.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace("mercaderia", "")
    .trim();

  if (nombreLimpio.length === 6 && !isNaN(nombreLimpio)) {
    const dia = nombreLimpio.substring(0, 2);
    const mes = nombreLimpio.substring(2, 4);
    const anioCorto = nombreLimpio.substring(4, 6);
    return `20${anioCorto}-${mes}-${dia}`;
  }
  return null;
}

async function importarHojasDeEntregas() {
  try {
    await sequelize.authenticate();
    console.log('🔌 Conexión establecida con MySQL en Aiven...');
    
    console.log('🏗️ Sincronizando estructuras de tablas (Limpieza inicial)...');
    await sequelize.sync(); 
    console.log('✅ Tablas limpias.');

    console.log('👤 Verificando usuario responsable por defecto...');
    await User.findOrCreate({
      where: { id: 1 },
      defaults: { username: 'alicia', password: 'password_temporal' }
    });

    const filePath = path.join(__dirname, EXCEL_FILE_NAME);
    const workbook = XLSX.readFile(filePath);
    const todasLasHojas = workbook.SheetNames;

    // ==========================================
    // PASO 1: CARGAR EL PADRÓN PRINCIPAL (Con chequeo de duplicados)
    // ==========================================
    console.log(`\n📋 [PASO 1] Cargando familias desde la pestaña principal [${NOMBRE_HOJA_PADRON}]...`);
    const hojaPadron = workbook.Sheets[todasLasHojas.find(h => h.toLowerCase() === NOMBRE_HOJA_PADRON.toLowerCase())];
    
    if (!hojaPadron) {
      throw new Error(`No se encontró la pestaña principal llamada "${NOMBRE_HOJA_PADRON}"`);
    }

    const filasPadron = XLSX.utils.sheet_to_json(hojaPadron);
    let totalFamilias = 0;

    for (const row of filasPadron) {
      const dniExcel = row['DNI'] || row['dni'] || row['Dni'] || row['Documento'];
      if (!dniExcel) continue;

      const dniLimpio = String(dniExcel).trim().replace(/[\.\,]/g, '');
      if (isNaN(dniLimpio) || dniLimpio.length < 6) continue;

      const nombreReal = row['FAMILIA'] || row['NOMBRE'] || row['Nombre'] || null;
      if (!nombreReal) continue; 

      const direccionReal = row['DIRECCIÓN'] || row['DIRECCION'] || row['Dirección'] || row['Domicilio'] || null;
      const telefonoReal = row['CONTACTO'] || row['TELEFONO'] || row['Teléfono'] || null;

      // ⭐ CAMBIO AQUÍ: Verificamos si el DNI ya se procesó en este mismo padrón para evitar el error de duplicados
      let existeFamilia = await Family.findOne({ where: { dni: dniLimpio } });

      if (!existeFamilia) {
        await Family.create({
          fullName: nombreReal,
          dni: dniLimpio,
          address: direccionReal,
          phone: telefonoReal,
          UserId: 1
        });
        totalFamilias++;
      } else {
        console.log(`   ⚠️ DNI ${dniLimpio} duplicado en el Excel (Saltando para evitar errores).`);
      }
    }
    console.log(`✅ ¡Padrón cargado con éxito! Se registraron ${totalFamilias} familias únicas con sus datos reales.`);
    // ==========================================
    // PASO 2: CARGAR HISTORIAL DE ENTREGAS
    // ==========================================
    console.log('\n📦 [PASO 2] Procesando pestañas de historial de entregas...');
    let totalEntregasCargadas = 0;

    for (const sheetName of todasLasHojas) {
      if (sheetName.toLowerCase() === NOMBRE_HOJA_PADRON.toLowerCase()) continue;

      const fechaFormateada = extraerFecha(sheetName);
      if (!fechaFormateada) continue;

      console.log(`📂 Procesando entregas del [${sheetName}] ➡️ Fecha: ${fechaFormateada}`);

      const worksheet = workbook.Sheets[sheetName];
      const filas = XLSX.utils.sheet_to_json(worksheet);
      let cargadosEnHoja = 0;

      for (const row of filas) {
        const dniExcel = row['DNI'] || row['dni'] || row['Dni'];
        if (!dniExcel) continue;

        const dniLimpio = String(dniExcel).trim().replace(/[\.\,]/g, '');
        
        let family = await Family.findOne({ where: { dni: dniLimpio } });

        if (!family) {
          // Si aparece un DNI loco en el historial que no estaba en el Padrón, lo guardamos igual
          const nombreTemporal = row['FAMILIA'] || row['NOMBRE'] || row['Nombre'] || 'Sin nombre asignado';
          family = await Family.create({
            fullName: nombreTemporal,
            dni: dniLimpio,
            UserId: 1
          });
        }

        const existeEntrega = await Delivery.findOne({
          where: { FamilyId: family.id, date: fechaFormateada }
        });

        if (!existeEntrega) {
          await Delivery.create({
            date: fechaFormateada,
            notes: row['NOTAS'] || row['Notas'] || row['Observaciones'] || 'Importado de pestaña historial',
            FamilyId: family.id
          });
          cargadosEnHoja++;
          totalEntregasCargadas++;
        }
      }
      console.log(`   ✨ OK: ${cargadosEnHoja} entregas vinculadas.`);
    }

    console.log('\n🎉 ¡PROCESO DE SUBIDA A LA NUBE COMPLETADO! 🎉');
    console.log(`✅ Familias cargadas con datos reales: ${totalFamilias}`);
    console.log(`📦 Historial de entregas vinculadas: ${totalEntregasCargadas}`);

  } catch (error) {
    console.error('❌ Error crítico en la importación:', error);
  } finally {
    await sequelize.close();
    console.log('🔒 Conexión con Aiven cerrada.');
  }
}

importarHojasDeEntregas();