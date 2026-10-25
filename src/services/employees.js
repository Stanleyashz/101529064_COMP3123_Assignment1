const Employee = require('../models/Employee');

/**
 * Every query that reads or changes an employee is scoped by the owner's ID.
 * Ownership comes from the verified JWT, never from client-supplied data.
 */
const listByOwner = (ownerId) => Employee.find({ user: ownerId }).sort({ created_at: -1 });
const createForOwner = (ownerId, data) => Employee.create({ ...data, user: ownerId });
const findById = (id) => Employee.findById(id);
const findOwned = (id, ownerId) => Employee.findOne({ _id: id, user: ownerId });

function isOwner(employee, ownerId) {
  return Boolean(employee) && String(employee.user) === String(ownerId);
}

module.exports = { listByOwner, createForOwner, findById, findOwned, isOwner };
