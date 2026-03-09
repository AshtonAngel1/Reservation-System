document.addEventListener("DOMContentLoaded", async () => {

    const bioInput = document.getElementById("bioInput");
    const updateBioBtn = document.getElementById("updateBioBtn");

    const pastList = document.getElementById("pastReservations");
    const todayList = document.getElementById("todayReservations");
    const futureList = document.getElementById("futureReservations");

    const userEmail = document.getElementById("userEmail");
    const userId = document.getElementById("userId");
    const profilePic = document.getElementById("profile-picture");

    try {

        const res = await fetch("/api/profile");

        if (!res.ok) {
            throw new Error("Failed to fetch profile");
        }

        const data = await res.json();
        const user = data;
        
        // populate profile
        userEmail.textContent = user.email;
        userId.textContent = user.id;
        bioInput.value = user.bio || "";

        // set profile picture safely
        if (user.profile_picture && user.profile_picture !== "") {
            profilePic.src = user.profile_picture;
        } else {
            profilePic.src = "/components/profile-pic.png"; // default placeholder
        }
        
        // if (user.profile_picture) {
        //     profilePic.src = user.profile_picture;
        // }

        // render reservations
        function renderReservations(list, container) {

            container.innerHTML = "";

            if (list.length === 0) {
                container.innerHTML = "<li>No reservations</li>";
                return;
            }

            list.forEach(r => {

                const li = document.createElement("li");

                li.textContent =
                    `${r.item_name} (${r.item_type}) 
                    ${new Date(r.start_date).toLocaleString()} 
                    → 
                    ${new Date(r.end_date).toLocaleString()}`;

                container.appendChild(li);

            });
        }

        renderReservations(past, pastList);
        renderReservations(today, todayList);
        renderReservations(future, futureList);

        // update bio
        updateBioBtn.addEventListener("click", async () => {

            const newBio = bioInput.value.trim();

            const res = await fetch("/profile/bio", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ bio: newBio })
            });

            const result = await res.json();

            if (res.ok) {
                alert("Bio updated");
            } else {
                alert(result.error);
            }

        });

    } catch (err) {

        console.error(err);
        alert("Error loading profile");

    }

});

