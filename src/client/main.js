const appEl = document.querySelector(".app");
const openModalBtn = document.getElementById("open-modal");
const modalBackdrop = document.getElementById("modal-backdrop");
const closeModalBtn = document.getElementById("close-modal");
const formEl = document.getElementById("question-form");
const questionInput = document.getElementById("question-input");
const answerEl = document.getElementById("answer");

function openModal() {
  modalBackdrop.classList.remove("hidden");
  setTimeout(() => questionInput.focus(), 50);
}

function closeModal() {
  modalBackdrop.classList.add("hidden");
  stopProcessing();
}

function startProcessing() {
  appEl.classList.add("processing");
}

function stopProcessing() {
  appEl.classList.remove("processing");
}

openModalBtn.addEventListener("click", openModal);
closeModalBtn.addEventListener("click", closeModal);

modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeModal();
});

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = questionInput.value.trim();
  if (!question) return;

  startProcessing();
  answerEl.classList.remove("hidden");
  answerEl.textContent = "Consulting Fortuna…";

  try {
    // Replace with your real backend call
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const mockAnswer =
      "Here you’ll see the answer from the model once the backend is connected.";
    answerEl.textContent = mockAnswer;
  } catch (err) {
    console.error(err);
    answerEl.textContent = "Something went wrong while reaching Fortuna.";
  } finally {
    stopProcessing();
  }
});
