const form = document.getElementById("fortune-form");
const questionInput = document.getElementById("question");
const output = document.getElementById("fortune-output");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  output.textContent = "Consulting the stars…";

  try {
    const res = await fetch("/api/fortune", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: questionInput.value })
    });

    if (!res.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await res.json();
    output.textContent = data.fortune;
  } catch (err) {
    output.textContent = "The nebula is silent. Try again.";
    console.error(err);
  }
});
