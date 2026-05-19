const Service = require('../models/Service');
const ApiError = require('../utils/ApiError');

/**
 * GET /api/services
 * Get all active services
 */
const getServices = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.active !== undefined) {
      filter.active = req.query.active === 'true';
    } else {
      filter.active = true;
    }

    const services = await Service.find(filter).sort({ name: 1 }).lean();

    res.status(200).json({
      success: true,
      data: { services },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/services
 * Create a new service (admin only)
 */
const createService = async (req, res, next) => {
  try {
    const { name, description, prefix, capacityPerHour } = req.body;

    if (!name || !prefix) {
      throw new ApiError(400, 'Service name and prefix are required.');
    }

    // Check duplicate prefix
    const existing = await Service.findOne({ prefix: prefix.toUpperCase() });
    if (existing) {
      throw new ApiError(400, `A service with prefix "${prefix}" already exists.`);
    }

    const service = await Service.create({
      name,
      description,
      prefix: prefix.toUpperCase(),
      capacityPerHour: capacityPerHour || 20,
    });

    res.status(201).json({
      success: true,
      message: 'Service created successfully.',
      data: { service },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/services/:id
 * Update a service (admin only)
 */
const updateService = async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new ApiError(400, 'Invalid service ID.');
    }

    // Whitelist allowed fields — prevents mass-assignment
    const { name, description, prefix, capacityPerHour, active } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (prefix !== undefined) {
      updateData.prefix = prefix.toUpperCase();
      // Check for duplicate prefix (excluding current service)
      const existing = await Service.findOne({
        prefix: updateData.prefix,
        _id: { $ne: req.params.id },
      });
      if (existing) {
        throw new ApiError(400, `A service with prefix "${updateData.prefix}" already exists.`);
      }
    }
    if (capacityPerHour !== undefined) updateData.capacityPerHour = capacityPerHour;
    if (active !== undefined) updateData.active = active;

    if (Object.keys(updateData).length === 0) {
      throw new ApiError(400, 'No valid fields to update.');
    }

    const service = await Service.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!service) throw new ApiError(404, 'Service not found.');

    res.status(200).json({
      success: true,
      message: 'Service updated successfully.',
      data: { service },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/services/:id
 * Soft delete (deactivate) a service
 */
const deleteService = async (req, res, next) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );

    if (!service) throw new ApiError(404, 'Service not found.');

    res.status(200).json({
      success: true,
      message: 'Service deactivated.',
      data: { service },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getServices, createService, updateService, deleteService };
