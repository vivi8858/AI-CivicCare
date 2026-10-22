const express = require("express");

const router = express.Router();

router.post("/predict", async (req, res) => {
  const { description } = req.body || {};

  if (
    typeof description !== "string" ||
    !description.trim() ||
    description.length > 5000
  ) {
    return res.status(400).json({
      error: "Description must contain 1 to 5000 characters"
    });
  }

  try {
    const response = await fetch("http://127.0.0.1:8000/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        description: description.trim()
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      return res.status(502).json({
        error: "AI service returned an error"
      });
    }

    const prediction = await response.json();

    return res.json(prediction);
  } catch (error) {
    console.error("AI service request failed:", error.message);

    return res.status(503).json({
      error: "AI service is currently unavailable"
    });
  }
});

module.exports = router;
