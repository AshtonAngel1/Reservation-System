// profile.js

document.addEventListener("DOMContentLoaded", async () => {
    const bioInput = document.getElementById("bioInput");
    const updateBioBtn = document.getElementById("updateBioBtn");
    const pastList = document.getElementById("pastReservations");
    const todayList = document.getElementById("todayReservations");
    const futureList = document.getElementById("futureReservations");
    const userEmail = document.getElementById("userEmail");
    const userId = document.getElementById("userId");
  
    try {
      // Fetch user profile data
      const res = await fetch("/profile");
      if (!res.ok) throw new Error("Failed to fetch profile data");
  
      const data = await res.json();
      const { user, past, today, future } = data;
  
      // Populate user info
      userEmail.textContent = user.email;
      userId.textContent = `ID: ${user.id}`;
      bioInput.value = user.bio || "";
  
      // Helper to render reservations
      function renderReservations(list, container) {
        container.innerHTML = "";
        if (list.length === 0) {
          container.innerHTML = "<p>No reservations</p>";
          return;
        }
        list.forEach(r => {
          const li = document.createElement("li");
          li.textContent = `${r.item_name} (${r.item_type}) - ${new Date(r.start_date).toLocaleString()} to ${new Date(r.end_date).toLocaleString()}`;
          container.appendChild(li);
        });
      }
  
      renderReservations(past, pastList);
      renderReservations(today, todayList);
      renderReservations(future, futureList);
  
      // Update bio
      updateBioBtn.addEventListener("click", async () => {
        const newBio = bioInput.value.trim();
        const updateRes = await fetch("/profile/bio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bio: newBio }),
        });
        const result = await updateRes.json();
        if (updateRes.ok) alert(result.message);
        else alert(result.error || "Failed to update bio");
      });
    } catch (err) {
      console.error(err);
      alert("Error loading profile page");
    }
  });
