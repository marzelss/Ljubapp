// --- CONFIGURE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAhNkyI7aG6snk2hPergYyGdftBBN9M1h0",
  authDomain: "ljubapp.firebaseapp.com",
  databaseURL: "https://ljubapp-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ljubapp",
  storageBucket: "ljubapp.firebasestorage.app",
  messagingSenderId: "922849938749",
  appId: "1:922849938749:web:59c06714af609e478d0954"
};

// --- HANDLE RE-ENTRY CASE ---
const currentGame = localStorage.getItem("currentGame");

// If no currentGame → skip all game logic, go straight to profile
if (!currentGame) {
  document.addEventListener("DOMContentLoaded", () => {
    window.location.replace("../profile/profile.html");
  });
  throw new Error("Game already completed — skipping result logic.");
}

// Disable back navigation
history.pushState(null, null, location.href);
window.onpopstate = () => history.go(1);

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- LOAD LOCAL DATA ---
const username = localStorage.getItem("playerName") || "Player";
let userPoints = parseInt(localStorage.getItem("userPoints") || "0");

// Immediately reset localStorage so reloading won’t give points again
localStorage.setItem("userPoints", "0");

// NEW: dynamic game name
const gameName = currentGame;

// --- GLOBAL totalPoints ---
let totalPoints = 0; // <-- moved here so it's accessible everywhere

// --- DOM ELEMENTS ---
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");
const pointsDisplay = document.getElementById("pointsDisplay");
const claimSection = document.getElementById("claimSection");
const prizeGrid = document.getElementById("prizeGrid");
const profileBtn = document.getElementById("profileBtn");
const confirmPrizeBtn = document.getElementById("confirmPrizeBtn");

let selectedPrize = null;

// --- LOAD WINNER INFO ---
db.ref(`${gameName}/gameSummary`).once("value").then(async snapshot => {
  const summary = snapshot.val();
  const winner = summary?.winner || "Nobody";
  const maxPoints = summary?.maxPoints || 0;

  // --- Get previous points if exist ---
  const userRef = db.ref(`users/${username}`);
  const userSnapshot = await userRef.once("value");
  const prevPoints = userSnapshot.exists() ? parseInt(userSnapshot.val().points || 0) : 0;

  // --- Prevent double points ---
  const claimRef = db.ref(`${gameName}/gameSummary/claimedBy/${username}`);
  const claimSnap = await claimRef.once("value");
  const alreadyClaimed = claimSnap.exists() && claimSnap.val() === true;

  if (!alreadyClaimed) {
    // First time visiting → give and save points
    totalPoints = prevPoints + userPoints;
    await claimRef.set(true);
    await userRef.update({ points: totalPoints });
  } else {
    // Already claimed → do not add points again
    totalPoints = prevPoints;
  }

  // --- Update localStorage too ---
  localStorage.setItem("totalPoints", totalPoints);

  // --- Update UI based on winner ---
  if (winner === username) {
    resultTitle.textContent = "Congratulations, you won 🎉";
    claimSection.classList.remove("hidden");
    loadPrizes();
  } else {
    resultTitle.textContent = "Better luck next time 🥀";
    profileBtn.classList.remove("hidden");
  }

  resultText.textContent = `${winner} won with ${maxPoints} points!`;
  pointsDisplay.textContent = `🎯 Total: ${totalPoints}`;
});

// --- LOAD PRIZES ---
function loadPrizes() {
  fetch("../files/prizes.json")
    .then(res => res.json())
    .then(prizes => {
      prizes.forEach(prize => {
        const card = document.createElement("div");
        card.className = "prize-card";
        card.dataset.emoji = prize.emoji;
        card.dataset.title = prize.title;
        card.dataset.points = prize.points;

        const canAfford = totalPoints >= prize.points; // <-- global variable

        card.innerHTML = `
          <div class="prize-emoji">${prize.emoji}</div>
          <div class="prize-title">${prize.title}</div>
          <div class="prize-points">${prize.points} pts</div>
        `;

        if (!canAfford) {
          card.classList.add("disabled");
          card.style.opacity = "0.4";
          card.style.cursor = "not-allowed";
        } else {
          card.addEventListener("click", () => {
            document.querySelectorAll(".prize-card").forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");
            selectedPrize = prize;
            confirmPrizeBtn.classList.remove("hidden");
          });
        }

        prizeGrid.appendChild(card);
      });
    });
}

// --- CONFIRM PRIZE SELECTION ---
confirmPrizeBtn.addEventListener("click", async () => {
  if (!selectedPrize) return;

  // Proceed only if user has just played (prevent re enter page through back button)
  const currentGame = localStorage.getItem("currentGame");
  if (currentGame) {
      
    // Deduct points
    totalPoints -= selectedPrize.points;
    localStorage.setItem("totalPoints", totalPoints);
  
    // Prepare prize data (⚠️ unclaimed — no claimedAt yet)
    const prizeData = {
      title: selectedPrize.title,
      emoji: selectedPrize.emoji,
      points: selectedPrize.points,
      duration: selectedPrize.duration || {},
      status: "unclaimed"
    };
  
    const userRef = db.ref(`users/${username}`);
  
    // Save updated points and add prize to user history
    await userRef.update({ points: totalPoints });
    await userRef.child("prizesCollected").push(prizeData);
  }

  // Redirect to profile
  window.location.href = "../profile/profile.html";
});

// --- PROFILE BUTTON ---
profileBtn.addEventListener("click", async () => {
  const userRef = db.ref(`users/${username}`);
  const snapshot = await userRef.once("value");

  if (!snapshot.exists()) {
    await userRef.set({
      points: totalPoints,
      prizesCollected: {}
    });
  } else {
    // make sure points are synced anyway
    await userRef.child("points").set(totalPoints);
  }

  window.location.href = "../profile/profile.html";
});
