const express = require("express");
const app = express();

app.use(express.json());
const path = require("path");

app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
  res.send("Reservation System Backend Running");
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
