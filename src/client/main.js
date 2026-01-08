const questionInput = document.getElementById("question");
const askButton = document.getElementById("ask-btn");
const statusEl = document.getElementById("status");
const resultSection = document.getElementById("result");
const fortuneText = document.getElementById("fortune-text");

async function askFortune() {
  const question = questionInput.value.trim();
  resultSection.classList.add("hidden");
  fortuneText.textContent = "";
  statusEl.classList.remove("status--error");

  if (!question) {
    statusEl.textContent = "Write a question to get a fortune.";
    statusEl.classList.add("status--error");
    return;
  }

  askButton.disabled = true;
  statusEl.textContent = "Consulting the universe…";

  try {
    const response = await fetch("/api/fortune", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ question })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Something went wrong.");
    }

    const data = await response.json();
    fortuneText.textContent = data.fortune || "Silence from the stars.";
    resultSection.classList.remove("hidden");
    statusEl.textContent = "";
  } catch (err) {
    console.error(err);
    statusEl.textContent = err.message || "Could not get a fortune.";
    statusEl.classList.add("status--error");
  } finally {
    askButton.disabled = false;
  }
}

askButton.addEventListener("click", askFortune);

questionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    askFortune();
  }
});
