firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)  // Keep session across tabs/windows
    .then(() => {
        // Listen for the user's authentication state
        firebase.auth().onAuthStateChanged(user => {
            if (!user) {
                // If no user is logged in, redirect to the login page
                window.location.href = 'login.html';
            } else {
                // Check for session expiration
                const sessionStartTime = localStorage.getItem('sessionStartTime');
                const currentTime = new Date().getTime();
                const maxSessionTime = 30 * 60 * 1000; // 30 minutes

                if (sessionStartTime && (currentTime - sessionStartTime) > maxSessionTime) {
                    firebase.auth().signOut().then(() => {
                        window.location.href = 'login.html';
                    });
                } else {
                    // Update session start time on each load
                    localStorage.setItem('sessionStartTime', currentTime);

                    // User is logged in, continue to show the main content
                    document.getElementById('container').style.display = 'block';
                }
            }
        });
    });
