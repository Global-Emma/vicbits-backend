const Project = require('../models/Project');
const Service = require('../models/Service');
const User = require('../models/User');
const { uploadToCloudinary } = require('../utils/cloudinaryHelper');
const { invalidateCache } = require('../utils/validation');

// CREATE PROJECT
const createProject = async (req, res) => {
  try {
    const file = req.file;

    const image = await uploadToCloudinary(file)
    
    const {
      title,
      description,
      price,
      service,
      level,
      duration,
      location,
      skills,
    } = req.body;

    if (!title || !description || !service) {
      return res.status(400).json({
        success: false,
        message: 'Title, description and service are required',
      });
    }

    const existingService = await Service.findOne({ name: service.toUpperCase() });

    if (!existingService) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    const project = await Project.create({
      title,
      description,
      price,
      service: existingService._id,
      level: level ? level.toLowerCase() : 'beginner',
      duration,
      location,
      skills,
      image: image ? image.secure_url : null,
      user: req.user._id,
    });

    if (!project) {
      return res.status(400).json({
        success: false,
        message: 'Error creating project',
      });
    }

    const updateService = await Service.findOneAndUpdate(
      { _id: project.service },
      { $push: { projects: project._id } }
    );

    if (!updateService) {
      return res.status(400).json({
        success: false,
        message: 'Error updating service with project',
      });
    }

    await invalidateCache(req.redisClient, `project:${project._id}`);

    await invalidateCache(req.redisClient, 'projects:all');

    await invalidateCache(req.redisClient, `service:${existingService._id}`);

    await invalidateCache(req.redisClient, 'services:all');

    return res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: project,
    });
  } catch (error) {
    console.log('Error in createProject:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// GET ALL PROJECTS
const getProjects = async (req, res) => {
  try {
    const cachedKey = 'projects:all';
    const cachedProjects = req.redisClient ? await req.redisClient.get(cachedKey) : null;

    if (cachedProjects) {
      console.log('Projects found in cache');
      return res.status(200).json({
        success: true,
        count: JSON.parse(cachedProjects).length,
        data: JSON.parse(cachedProjects),
      });
    }

    const projects = await Project.find()
      .populate('user')
      .populate('service')
      .populate({
        path:'applications',
        populate: {
          path: 'applicant',
          select: '-password -refreshToken'
        },
      })
      .sort({ createdAt: -1 });
      

    if (req.redisClient) {
      await req.redisClient.set(cachedKey, JSON.stringify(projects), 'EX', 3600);
    }

    return res.status(200).json({
      success: true,
      count: projects.length,
      data: projects,
    });
  } catch (error) {
    console.log('Error in getProjects:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// GET SINGLE PROJECT
const getProject = async (req, res) => {
  try {
    cachedKey = `project:${req.params.id}`;
    const cachedProject = req.redisClient ? await req.redisClient.get(cachedKey) : null;

    if (cachedProject) {
      console.log('Project found in cache');
      return res.status(200).json({
        success: true,
        data: JSON.parse(cachedProject),
      });
    }

    const project = await Project.findById(req.params.id)
      .populate({
        path: 'user',
        select: '-password -refreshToken',
      }).populate('service', 'name _id').exec();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    if (req.redisClient) {
      await req.redisClient.set(cachedKey, JSON.stringify(project), 'EX', 3600);
    }

    return res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.log('Error in getProject:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// UPDATE PROJECT
const updateProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    // OWNER CHECK 🔒
    if (project.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this project',
      });
    }

    const {
      title,
      description,
      price,
      service,
      level,
      duration,
      location,
      skills,
      image,
    } = req.body;

    const existingService = await Service.findOne({ name: service.toUpperCase() });

    if (!existingService) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    project.title = title || project.title;
    project.description = description || project.description;
    project.price = price || project.price;
    project.service = existingService._id || project.service;
    project.level = level?.toLowerCase() || project.level;
    project.duration = duration || project.duration;
    project.location = location || project.location;
    project.skills = skills || project.skills;
    project.image = image || project.image;

    const updatedProject = await project.save();

    await invalidateCache(req.redisClient, `project:${project._id}`);

    await invalidateCache(req.redisClient, 'projects:all');


    return res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: updatedProject,
    });
  } catch (error) {
    console.log('Error in updateProject:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// DELETE PROJECT
const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    // OWNER CHECK 🔒
    if (project.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this project',
      });
    }

    await project.deleteOne();

    await invalidateCache(req.redisClient, `project:${project._id}`);

    await invalidateCache(req.redisClient, 'projects:all');


    return res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    console.log('Error in deleteProject:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const saveProject = async(req, res)=>{
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    const user = await User.findById(req.user._id)
    if(!user){
      return res.status(404).json({
        success: false,
        message: 'user not found'
      })
    }

    user.savedProjects.push(project._id)
    await user.save()

    await invalidateCache(req.redisClient, `user:${user._id}`);

    return res.status(200).json({
      success: true,
      message: 'project saved successfully'
    })
  } catch (error) {
     console.log('Error Saving Project:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
}

const removeSavedProject = async(req, res)=>{
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    const user = await User.findById(req.user._id)
    if(!user){
      return res.status(404).json({
        success: false,
        message: 'user not found'
      })
    }

    user.savedProjects = user.savedProjects.filter(id => id.toString() !== project._id.toString())
    await user.save()

    await invalidateCache(req.redisClient, `user:${user._id}`);

    return res.status(200).json({
      success: true,
      message: 'project removed from saved successfully'
    })
  } catch (error) {
     console.log('Error Removing Saved Project:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
}

module.exports = {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
  saveProject,
  removeSavedProject
};