const { Router } = require('express');
const router = Router();
const Delivery = require('../models/delivery.model');
const Family = require('../models/family.model');
const User = require('../models/user.model');

// 1. OBTENER TODAS LAS ENTREGAS (Para armar el historial por fechas)
router.get('/', async (req, res) => {
  try {
    const deliveries = await Delivery.findAll({
      include: [
        {
          model: Family,
          attributes: ['id', 'fullName', 'dni', 'address'],
          include: [{ model: User, attributes: ['username'] }] // Incluye el compañero asignado
        }
      ],
      order: [['date', 'DESC'], ['createdAt', 'DESC']] // Ordena por fecha más reciente
    });
    res.status(200).json(deliveries);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al traer el historial de entregas.' });
  }
});

// 2. REGISTRAR ENTREGA POR DNI EN UNA FECHA ESPECÍFICA
router.get('/register-by-dni', async (req, res) => {
  try {
    const { dni, date, notes } = req.query; // Recibe DNI y la fecha de la carpeta activa

    if (!dni || !date) {
      return res.status(400).json({ message: 'Faltan datos obligatorios (DNI o Fecha).' });
    }

    // Buscamos si el DNI existe en el padrón de familias
    const family = await Family.findOne({ where: { dni } });

    if (!family) {
      return res.status(404).json({ message: 'No se encontró ninguna familia con ese DNI en el padrón.' });
    }

    // Verificamos si ya se le entregó a esta familia en ESTA misma fecha (para evitar duplicados)
    const existingDelivery = await Delivery.findOne({
      where: {
        FamilyId: family.id,
        date: date
      }
    });

    if (existingDelivery) {
      return res.status(400).json({ message: `Esta familia ya recibió mercadería en la fecha ${date}.` });
    }

    // Si está todo bien, creamos el registro de entrega vinculado a la familia
    const newDelivery = await Delivery.create({
      date: date,
      notes: notes || '',
      FamilyId: family.id
    });

    // La volvemos a buscar completa para retornarla al frontend con los datos de la familia armada
    const completeDelivery = await Delivery.findByPk(newDelivery.id, {
      include: [
        {
          model: Family,
          attributes: ['id', 'fullName', 'dni', 'address'],
          include: [{ model: User, attributes: ['username'] }]
        }
      ]
    });

    res.status(201).json({ message: 'Entrega registrada con éxito.', delivery: completeDelivery });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al procesar la entrega.', error: error.message });
  }
});
// 3. RUTA DELETE: Eliminar una entrega por su ID
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const delivery = await Delivery.findByPk(id);

    if (!delivery) {
      return res.status(404).json({ message: 'No se encontró la asistencia que querés eliminar.' });
    }

    await delivery.destroy();
    res.status(200).json({ message: 'Asistencia eliminada con éxito.' });
  } catch (error) {
    console.error('Error al eliminar asistencia:', error);
    res.status(500).json({ message: 'Error interno al intentar eliminar la asistencia.' });
  }
});

module.exports = router;