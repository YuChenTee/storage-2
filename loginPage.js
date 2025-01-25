firebase.auth().onAuthStateChanged(user => {
    if (user) {
        // Update session start time on each login page load
        localStorage.setItem('sessionStartTime', new Date().getTime());
        // Redirect to index.html since the user is already logged in
        window.location.href = 'index.html';
    }
});

document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    const loginMessage = document.getElementById('loginMessage');

    firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Successful login
            const user = userCredential.user;
            loginMessage.style.color = 'green';
            loginMessage.style.display = 'block';
            loginMessage.textContent = 'Login successful!';

            // Store session start time
            localStorage.setItem('sessionStartTime', new Date().getTime());
            
            // Redirect to the material management page or wherever you need to go
            window.location.href = 'index.html';
        })
        .catch((error) => {
            // Handle errors
            loginMessage.style.color = 'red';
            loginMessage.style.display = 'block';
            loginMessage.textContent = `Error: Wrong Login Information.`;
        });
});