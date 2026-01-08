const hero = document.getElementById("hero");
const beginButton = document.getElementById("begin-btn");

const fortuneCard = document.getElementById("fortune-card");
const questionInput = document.getElementById("question");
const askButton = document.getElementById("ask-btn");
const statusEl = document.getElementById("status");
const resultSection = document.getElementById("result");
const fortuneText = document.getElementById("fortune-text");

// "Once per visit" flag (per browser tab / session)
const SESSION_KEY = "fortuna_has_spoken";
let hasSpoken = sessionStorage.getItem(SESSION_KEY) === "true";

function showCard() {
  // Transition from hero to card
  if (hero) {
    hero.style.opacity = "0";
    hero.style.transform = "translateY(-8px)";
    setTimeout(() => {
      hero.style.display = "none";
      fortuneCard.classList.remove("card--hidden");
      fortuneCard.classList.add("card--visible");
      fortuneCard.setAttribute("aria-hidden", "false");
      questionInput.focus();
    }, 260);
  } else {
    // Fallback if hero not present
    fortuneCard.classList.remove("card--hidden");
    fortuneCard.classList.add("card--visible");
    fortuneCard.setAttribute("aria-hidden", "false");
  }
}

async function askFortune() {
  const question = questionInput.value.trim();
  resultSection.classList.add("hidden");
  fortuneText.textContent = "";
  statusEl.classList.remove("status--error", "status--soft");

  // If Fortuna already answered in this session, gently stop
  if (hasSpoken) {
    statusEl.textContent =
      "Fortuna has spoken for today. Sit with this answer and return with a new question another time.";
    statusEl.classList.add("status--soft");
    return;
  }

  if (!question) {
    statusEl.textContent = "Write one clear question to receive a fortune.";
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

    // Mark that Fortuna has answered for this session
    hasSpoken = true;
    sessionStorage.setItem(SESSION_KEY, "true");
  } catch (err) {
    console.error(err);
    statusEl.textContent = err.message || "Could not get a fortune.";
    statusEl.classList.add("status--error");
  } finally {
    askButton.disabled = false;
  }
}

// Events

if (beginButton) {
  beginButton.addEventListener("click", showCard);
}

// If user reloads and Fortuna has already spoken, still allow seeing the card
window.addEventListener("load", () => {
  // Auto-show card if hero is missing (defensive) or user scrolls
  // For now we keep hero as the entry point.
});

askButton.addEventListener("click", askFortune);

questionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    askFortune();
  }
});
