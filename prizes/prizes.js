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

// Disable back navigation
history.pushState(null, null, location.href);
window.onpopstate = () => history.go(1);

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- LOAD LOCAL DATA ---
const username = localStorage.getItem("playerName") || "Player";

// --- DOM ELEMENTS ---
const pointsDisplay = document.getElementById("pointsDisplay");
const claimSection = document.getElementById("claimSection");
const prizeGrid = document.getElementById("prizeGrid");
const profileBtn = document.getElementById("profileBtn");
const confirmPrizeBtn = document.getElementById("confirmPrizeBtn");

let selectedPrize = null;

// --- LOAD WINNER INFO ---
let totalPoints = 0; // make global

// --- LOAD USER INFO ---
db.ref(`users/${username}`).once("value").then(snapshot => {
  const user = snapshot.val();
  totalPoints = user.points || 0;

  // Update UI + localStorage
  pointsDisplay.textContent = `🎯 Total: ${totalPoints}`;
  localStorage.setItem("totalPoints", totalPoints);

  claimSection.classList.remove("hidden");

  // Now we can load prizes
  loadPrizes();
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

  // Deduct
  totalPoints -= selectedPrize.points;
  localStorage.setItem("totalPoints", totalPoints);

  // Prepare prize object
  const prizeData = {
    title: selectedPrize.title,
    emoji: selectedPrize.emoji,
    points: selectedPrize.points,
    duration: selectedPrize.duration || {},
    status: "unclaimed"
  };

  const userRef = db.ref(`users/${username}`);
  await userRef.update({ points: totalPoints });
  await userRef.child("prizesCollected").push(prizeData);

  // Hide all main content
  document.getElementById("pointsContainer").classList.add("hidden");
  document.getElementById("claimSection").classList.add("hidden");
  
  // Show success message
  document.getElementById("successMessage").classList.remove("hidden");

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
