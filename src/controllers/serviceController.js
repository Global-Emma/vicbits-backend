const Service = require('../models/Service');

// CREATE SERVICE

const services = [
  {
    id: 1,
    name: "WEB DEVELOPMENT",
    icon: 'code'
  },
  {
    id: 2,
    name: "AI AUTOMATION",
    icon: 'bot'
  },
  {
    id: 3,
    name: "APP DEVELOPMENT",
    icon: 'smartphone'
  },
  {
    id: 4,
    name: "WEB DESIGN",
    icon: 'palette'
  },
  {
    id: 5,
    name: "GRAPHIC DESIGN",
    icon: 'brush'
  },
  {
    id: 6,
    name: "CYBER SECURITY",
    icon: 'shield'
  },
  {
    id: 7,
    name: "DATA ANALYSIS",
    icon: 'barchart'
  },
  {
    id: 8,
    name: "DEVOPS & CLOUD",
    icon: 'cloud'
  },
];

// const seedServices = async () => {
//   try {
//       await Service.insertMany(services);
//       console.log('Services seeded successfully');
    
//   } catch (error) {
//     console.log('Error seeding services:', error);
//   }
// };

// seedServices();

const createService = async (req, res) => {
  try {
    const { name, icon } = req.body;

    if (!name || !icon) {
      return res.status(400).json({
        success: false,
        message: 'Name and icon are required',
      });
    }

    const existingService = await Service.findOne({ name });

    if (existingService) {
      return res.status(400).json({
        success: false,
        message: 'Service already exists',
      });
    }

    const service = await Service.create({
      name,
      icon,
      createdBy: req.user?._id,
    });

    if (!service) {
      return res.status(400).json({
        success: false,
        message: 'Error creating service',
      });
    }

    await invalidateCache(req.redisClient, 'services:all');
    await invalidateCache(req.redisClient, `service:${service._id}`);

    return res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: service,
    });
  } catch (error) {
    console.log('Error in createService:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// GET ALL SERVICES
const getServices = async (req, res) => {
  try {
    const cachedKey = 'services:all';
    const cachedServices = req.redisClient ? await req.redisClient.get(cachedKey) : null;

    if (cachedServices) {
      console.log('Services found in cache');
      return res.status(200).json({
        success: true,
        data: JSON.parse(cachedServices),
      });
    }

    const services = await Service.find().sort({ createdAt: -1 });

    if (req.redisClient) {
      await req.redisClient.set(cachedKey, JSON.stringify(services), 'EX', 3600);
    }

    return res.status(200).json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (error) {
    console.log('Error in getServices:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// GET SINGLE SERVICE
const getService = async (req, res) => {
  try {
    const cachedKey = `service:${req.params.id}`;
    const cachedService = req.redisClient ? await req.redisClient.get(cachedKey) : null;

    if (cachedService) {
      console.log('Service found in cache');
      return res.status(200).json({
        success: true,
        data: JSON.parse(cachedService),
      });
    }

    const service = await Service.findById(req.params.id)
      .populate({
      path: 'projects',
      populate: {
        path: 'user', 
        select: '-password -refreshToken'
      }
      })
      .populate({
      path: 'projects',
      populate: {
        path: 'service',
        select: 'name _id'
      }
      })
      .exec();

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    if (req.redisClient) {
      await req.redisClient.set(cachedKey, JSON.stringify(service), 'EX', 3600);
    }

    return res.status(200).json({
      success: true,
      data: service,
    });
  } catch (error) {
    console.log('Error in getService:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// UPDATE SERVICE
const updateService = async (req, res) => {
  try {
    const { name, icon } = req.body;

    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    service.name = name || service.name;
    service.icon = icon || service.icon;

    const updatedService = await service.save();

    await invalidateCache(req.redisClient, `service:${service._id}`);

    await invalidateCache(req.redisClient, 'services:all');

    return res.status(200).json({
      success: true,
      message: 'Service updated successfully',
      data: updatedService,
    });
  } catch (error) {
    console.log('Error in updateService:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// DELETE SERVICE
const deleteService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    await service.deleteOne();

    await invalidateCache(req.redisClient, `service:${service._id}`);

    await invalidateCache(req.redisClient, 'services:all');

    return res.status(200).json({
      success: true,
      message: 'Service deleted successfully',
    });
  } catch (error) {
    console.log('Error in deleteService:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

module.exports = {
  createService,
  getServices,
  getService,
  updateService,
  deleteService,
};