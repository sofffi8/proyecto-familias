const { Router } = require('express');
const router = Router();
const Delivery = require('../models/delivery.model');
const Family = require('../models/family.model');
const User = require('../models/user.model');

// 1. OBTENER TODAS LAS ENTREGAS
router.get('/', async (req, res) => {
  try {
    const deliveries = await Delivery.findAll({
      include: [
        {
          model: Family,
          attributes: ['id', 'fullName', 'dni', 'address', 'compFamiliar'], 
          include: [{ model: User, attributes: ['username'] }]
        }
      ],
      order: [['date', 'DESC'], ['createdAt', 'DESC']]
    });
    res.status(200).json(deliveries);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al traer el historial de entregas.' });
  }
});

// 2. REGISTRAR ENTREGA POR DNI
router.get('/register-by-dni', async (req, res) => {
  try {
    const { dni, date, notes } = req.query;

    if (!dni || !date) {
      return res.status(400).json({ message: 'Faltan datos obligatorios.' });
    }

    const family = await Family.findOne({ where: { dni } });

    if (!family) {
      return res.status(404).json({ message: 'No se encontró la familia.' });
    }

    const existingDelivery = await Delivery.findOne({
      where: { FamilyId: family.id, date: date }
    });

    if (existingDelivery) {
      return res.status(400).json({ message: `Esta familia ya recibió mercadería en la fecha ${date}.` });
    }

    const newDelivery = await Delivery.create({
      date: date,
      notes: notes || '',
      FamilyId: family.id
    });

    const completeDelivery = await Delivery.findByPk(newDelivery.id, {
      include: [
        {
          model: Family,
          // 🟢 Y TAMBIÉN AQUÍ PARA CUANDO CARGAS UNA NUEVA
          attributes: ['id', 'fullName', 'dni', 'address', 'compFamiliar'],
          include: [{ model: User, attributes: ['username'] }]
        }
      ]
    });

    res.status(201).json({ message: 'Entrega registrada con éxito.', delivery: completeDelivery });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al procesar la entrega.' });
  }
});

// 3. RUTA DELETE (Se mantiene igual)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const delivery = await Delivery.findByPk(id);
    if (!delivery) return res.status(404).json({ message: 'No se encontró la asistencia.' });
    await delivery.destroy();
    res.status(200).json({ message: 'Asistencia eliminada con éxito.' });
  } catch (error) {
    res.status(500).json({ message: 'Error interno al eliminar.' });
  }
});

module.exports = router;