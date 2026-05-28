const XLSX = require('xlsx');
const path = require('path');
const sequelize = require('./src/config/database');
const Family = require('./src/models/family.model');
const Delivery = require('./src/models/delivery.model');
const User = require('./src/models/user.model');

const EXCEL_FILE_NAME = 'Listado GENERAL.xlsx'; // Ojo: lo cambié con "GENERAL" en mayúsculas como está en tu carpeta
const NOMBRE_HOJA_PADRON = 'Listado'; 

// MAPEO DE RESPONSABLES (Nombres del Excel ➡️ IDs de la Base de Datos)
const userMapping = {
  'alicia': 1, 'ana': 2, 'angeles': 3, 'anto': 4, 'elena': 5,
  'fabian': 6, 'laura': 7, 'luciana': 8, 'marcia': 9, 'micaela': 10,
  'monica': 11, 'romina': 12, 'sandra': 13, 'silvia': 14, 'sofia': 15,
  'tamara': 16, 'victoria': 17
};

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
    // Fuerza a limpiar y recrear las tablas para vaciar lo viejo de Alicia
    await sequelize.sync({ force: true }); 
    console.log('✅ Tablas limpias y listas para reimportar.');

    console.log('👤 Verificando usuarios responsables en la base de datos...');
    // Creamos rápido los 17 usuarios por si las moscas para que no tire error de clave foránea
    for (const [username, id] of Object.entries(userMapping)) {
      await User.findOrCreate({
        where: { id: id },
        defaults: { username: username, password: 'password_temporal' }
      });
    }

    const filePath = path.join(__dirname, EXCEL_FILE_NAME);
    const workbook = XLSX.readFile(filePath);
    const todasLasHojas = workbook.SheetNames;

    // ==========================================
    // PASO 1: CARGAR EL PADRÓN PRINCIPAL (Con responsable real)
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

      // DETECTAR RESPONSABLE DEL EXCEL
      const responsableExcel = row['Responsable Asignado'] || row['RESPONSABLE'] || row['Responsable'] || 'alicia';
      const responsableClean = responsableExcel.toString().trim().toLowerCase();
      
      // Asignamos el ID real mapeado, y si no coincide con ninguno por error de tipeo, le dejamos el 1 (Alicia) por defecto
      const userIdAsignado = userMapping[responsableClean] || 1;

      let existeFamilia = await Family.findOne({ where: { dni: dniLimpio } });

      if (!existeFamilia) {
        await Family.create({
          fullName: nombreReal,
          dni: dniLimpio,
          address: direccionReal,
          phone: telefonoReal,
          UserId: userIdAsignado // ⭐ ¡AHORA USA EL RESPONSABLE REAL DE SU FILA!
        });
        totalFamilias++;
      } else {
        console.log(`   ⚠️ DNI ${dniLimpio} duplicado en el Excel (Saltando para evitar errores).`);
      }
    }
    console.log(`✅ ¡Padrón cargado con éxito! Se registraron ${totalFamilias} familias únicas.`);

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
          const nombreTemporal = row['FAMILIA'] || row['NOMBRE'] || row['Nombre'] || 'Sin nombre asignado';
          
          // Buscar responsable también para familias coladas en el historial
          const respExcel = row['Responsable Asignado'] || row['RESPONSABLE'] || row['Responsable'] || 'alicia';
          const uId = userMapping[respExcel.toString().trim().toLowerCase()] || 1;

          family = await Family.create({
            fullName: nombreTemporal,
            dni: dniLimpio,
            UserId: uId
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

    console.log('\n🎉 ¡PROCESO DE REIMPORTACIÓN COMPLETADO! 🎉');
    console.log(`✅ Familias cargadas con responsables reales: ${totalFamilias}`);
    console.log(`📦 Historial de entregas vinculadas: ${totalEntregasCargadas}`);

  } catch (error) {
    console.error('❌ Error crítico en la importación:', error);
  } finally {
    await sequelize.close();
    console.log('🔒 Conexión con Aiven cerrada.');
  }
}

importarHojasDeEntregas();