const { Router } = require('express');
const router = Router();
const Family = require('../models/family.model');
const User = require('../models/user.model');
const xlsx = require('xlsx'); 

// 1. RUTA POST: Registro individual de una familia (Por si cargás a mano)
router.post('/register', async (req, res) => {
  try {
    const { fullName, dni, birthDate, address, phone, UserId } = req.body;

    if (!fullName) {
      return res.status(400).json({ message: 'El nombre de la familia es obligatorio.' });
    }

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
      UserId: UserId || 1 
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
    const families = await Family.findAll({
      include: [{
        model: User,
        attributes: ['username'] 
      }]
    });
    
    res.status(200).json(families);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener el listado de familias.', error: error.message });
  }
});

// 3. RUTA POST: Importación masiva desde Excel
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
      
      const responsableExcel = row['RESPONSABLE'] ? String(row['RESPONSABLE']).trim().toLowerCase() : null;

      if (!fullName) continue;

      if (dni) {
        const exist = await Family.findOne({ where: { dni } });
        if (exist) {
          saltadas++;
          continue; 
        }
      }

      let asignadoUserId = defaultUserId || 1;

      if (responsableExcel) {
        const usuarioEncontrado = await User.findOne({ where: { username: responsableExcel } });
        if (usuarioEncontrado) {
          asignadoUserId = usuarioEncontrado.id;
        }
      }

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
}); // 💡 ¡LLAVE CORREGIDA AQUÍ! Cierra bien la importación

// 4. RUTA GET: Buscar familia por DNI
router.get('/by-dni/:dni', async (req, res) => {
  try {
    const { dni } = req.params;

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

// 5. RUTA PUT: Editar los datos de una familia existente
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, dni, phone, address, UserId } = req.body;

    const family = await Family.findByPk(id);
    if (!family) {
      return res.status(404).json({ message: 'Familia no encontrada' });
    }

    // Actualizamos con validación manual
    await family.update({
      fullName: fullName,
      dni: dni ? String(dni).trim() : null,
      phone: phone,
      address: address,
      UserId: parseInt(UserId)
    });

    const updatedFamily = await Family.findByPk(id, {
      include: [{ model: User, attributes: ['id', 'username'] }]
    });

    res.status(200).json({ message: 'Actualizado', family: updatedFamily });
  } catch (error) {
    // ESTO VA A ENVIAR EL MENSAJE REAL DE VALIDACIÓN AL FRONTEND
    console.error('Error detallado:', error);
    res.status(500).json({ message: error.errors ? error.errors[0].message : error.message });
  }
});

// 6. RUTA DELETE: Eliminar una familia por su ID
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const family = await Family.findByPk(id);

    if (!family) {
      return res.status(404).json({ message: 'No se encontró la familia que querés eliminar.' });
    }

    await family.destroy();
    res.status(200).json({ message: 'Familia eliminada con éxito del padrón.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar la familia.', error: error.message });
  }
});

module.exports = router;