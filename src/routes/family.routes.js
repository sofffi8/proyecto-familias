const { Router } = require('express');
const router = Router();
const Family = require('../models/family.model');
const User = require('../models/user.model');
const xlsx = require('xlsx'); 

// 1. RUTA POST: Registro individual de una familia (Por si cargás a mano)
router.post('/register', async (req, res) => {
  try {
    const { fullName, dni, birthDate, address, phone, UserId } = req.body;

    // Validamos que al menos venga el nombre completo
    if (!fullName) {
      return res.status(400).json({ message: 'El nombre de la familia es obligatorio.' });
    }

    // Si viene DNI, chequeamos que no esté repetido
    if (dni) {
      const exist = await Family.findOne({ where: { dni } });
      if (exist) {
        return res.status(400).json({ message: 'Ya existe una familia registrada con ese DNI.' });
      }
    }

    const newFamily = await Family.create({
      fullName,
      dni,
      birthDate,
      address,
      phone,
      UserId: UserId || 1 // Si no viene ID, le asigna el 1 por defecto
    });

    res.status(201).json({ message: 'Familia registrada con éxito.', newFamily });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al registrar la familia.', error: error.message });
  }
});


// 2. RUTA GET: Listar todas las familias (La que necesita React ahora)
router.get('/', async (req, res) => {
  try {
    // Buscamos todas las familias e incluimos el modelo User para saber quién es el responsable
    const families = await Family.findAll({
      include: [{
        model: User,
        attributes: ['username'] // Solo nos interesa traer el nombre de usuario
      }]
    });
    
    res.status(200).json(families);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener el listado de familias.', error: error.message });
  }
});


// 3. RUTA POST: Importación masiva desde Excel (VERSIÓN INTELIGENTE CON RESPONSABLE DINÁMICO)
router.post('/import', async (req, res) => {
  try {
    const { filePath, defaultUserId } = req.body; 

    if (!filePath) {
      return res.status(400).json({ message: 'Por favor, proporciona la ruta del archivo Excel.' });
    }

    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; 
    const worksheet = workbook.Sheets[sheetName];
    const excelData = xlsx.utils.sheet_to_json(worksheet);

    let creadas = 0;
    let saltadas = 0;

    for (const row of excelData) {
      const fullName = row['FAMILIA'];
      const dni = row['DNI'] ? String(row['DNI']) : null;
      const phone = row['CONTACTO'] ? String(row['CONTACTO']) : null;
      const address = row['DIRECCIÓN'] || null;
      
      // Capturamos el nombre del responsable que viene en la columna del Excel
      const responsableExcel = row['RESPONSABLE'] ? String(row['RESPONSABLE']).trim().toLowerCase() : null;

      if (!fullName) continue;

      // Verificamos si ya existe por DNI para no duplicar datos
      if (dni) {
        const exist = await Family.findOne({ where: { dni } });
        if (exist) {
          saltadas++;
          continue; 
        }
      }

      // LÓGICA DINÁMICA: Buscamos al usuario en la base de datos por su username
      let asignadoUserId = defaultUserId || 1; // Por defecto sos vos

      if (responsableExcel) {
        const usuarioEncontrado = await User.findOne({ where: { username: responsableExcel } });
        if (usuarioEncontrado) {
          asignadoUserId = usuarioEncontrado.id; // Si existe, guardamos su ID real
        }
      }

      // Creamos la familia con el ID del compañero correspondiente
      await Family.create({
        fullName,
        dni,
        birthDate: null, 
        address,
        phone,
        UserId: asignadoUserId
      });

      creadas++;
    }

    res.status(200).json({
      message: 'Proceso de importación finalizado con éxito.',
      familiasCreadas: creadas,
      familiasSaltadasPorDniRepetido: saltadas
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al procesar el archivo Excel', error: error.message });
  }

  router.get('/by-dni/:dni', async (req, res) => {
  try {
    const { dni } = req.params;

    // Buscamos la familia por DNI e incluimos su responsable asignado
    const family = await Family.findOne({
      where: { dni: dni },
      include: [{
        model: User,
        attributes: ['id', 'username']
      }]
    });

    if (!family) {
      return res.status(404).json({ message: 'No se encontró ninguna familia registrada con ese DNI.' });
    }

    res.status(200).json(family);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al buscar la familia por DNI.', error: error.message });
  }
 });

 // 5. NUEVA RUTA PUT: Editar los datos de una familia existente
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, dni, address, phone, UserId } = req.body;

    // Buscamos la familia en la base de datos
    const family = await Family.findByPk(id);

    if (!family) {
      return res.status(404).json({ message: 'No se encontró la familia para editar.' });
    }

    // Actualizamos los campos con lo que mande el frontend (o dejamos lo que ya estaba)
    family.fullName = fullName || family.fullName;
    family.dni = dni !== undefined ? dni : family.dni;
    family.address = address !== undefined ? address : family.address;
    family.phone = phone !== undefined ? phone : family.phone;
    family.UserId = UserId || family.UserId;

    await family.save();

    // Volvemos a buscarla incluyendo el usuario para devolvérsela actualizada a React
    const updatedFamily = await Family.findByPk(id, {
      include: [{ model: User, attributes: ['id', 'username'] }]
    });

    res.status(200).json({ message: 'Familia actualizada con éxito.', family: updatedFamily });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar la familia.', error: error.message });
  }
 });

 // 6. NUEVA RUTA DELETE: Eliminar una familia por su ID
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Buscamos si la familia existe
    const family = await Family.findByPk(id);

    if (!family) {
      return res.status(404).json({ message: 'No se encontró la familia que querés eliminar.' });
    }

    // La borramos de la base de datos
    await family.destroy();

    res.status(200).json({ message: 'Familia eliminada con éxito del padrón.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar la familia.', error: error.message });
  }
});
});

module.exports = router;