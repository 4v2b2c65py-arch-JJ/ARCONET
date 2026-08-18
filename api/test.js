module.exports = (req, res) => {
  res.status(200).json({ test: 'ok', time: new Date().toISOString() });
};
