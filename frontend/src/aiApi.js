const API_URL = "http://127.0.0.1:5001";

export async function predictComplaint(description) {
  const response = await fetch(`${API_URL}/api/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ description }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Prediction failed");
  }

  return data;
}
