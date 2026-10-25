const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    first_name: { type: String, required: true, trim: true },
    last_name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    position: { type: String, required: true, trim: true },
    salary: { type: Number, required: true, min: 0 },
    date_of_joining: { type: Date, required: true },
    department: { type: String, required: true, trim: true },
    // Owner of this record. Set from the verified JWT, never from the request body.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('Employee', employeeSchema);
