const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  pageNumber: {
    type: Number,
    required: true
  },
  text: {
    type: String,
    required: true
  }
});

const bookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Tecnología', 'Literatura', 'Historias Cortas', 'Humanidades', 'Ciencias Sociales']
  },
  image: {
    type: String,
    required: true
  },
  content: [pageSchema],

    createdAt: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model('Book', bookSchema);