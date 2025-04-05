// Function to handle the form submission
function handleSetThresholdFormSubmission() {
    document.getElementById('setThresholdForm').addEventListener('submit', function(e) {
        e.preventDefault();
        if (document.activeElement.id === 'setThresholdBtn') {
            confirmAction('Are you sure you want to set the material threshold?', setMaterialThreshold);
        } else if (document.activeElement.id === 'clearThresholdBtn') {
            confirmAction('Are you sure you want to clear the threshold for the selected material? <span style="color: red; font-weight: bold">This action cannot be undone.</span>', clearThresholdForMaterial);
        }
    });
}

// Function to set the material threshold
function setMaterialThreshold() {
    const materialName = document.getElementById('thresholdMaterialName').value;
    const thresholdQuantity = parseFloat(document.getElementById('thresholdQuantity').value);

    if (!materialName || thresholdQuantity <= 0) {
        showUpdateMessage('updateMessage3', 'Please select a valid material and enter a valid threshold quantity.', true);
        return;
    }

    // Write the threshold using set with merge = true
    db.collection("thresholds").doc("thresholds").set({
        [materialName]: thresholdQuantity
    }, { merge: true })
    .then(() => {
        console.log("Threshold set successfully for material:", materialName);
        showUpdateMessage('updateMessage3', `Threshold for ${materialName} successfully set to ${thresholdQuantity}.`);
        initializeThresholdCache();
    })
    .catch((error) => {
        console.error("Error setting threshold: ", error);
        showUpdateMessage('updateMessage3', `Error setting threshold: ${error.message}`, true);
    });
}

// Function to clear the threshold for the selected material
function clearThresholdForMaterial() {
    const materialName = document.getElementById('thresholdMaterialName').value;

    if (!materialName) {
        showUpdateMessage('updateMessage3', 'Please select a material.', true);
        return;
    }

    // Remove the threshold field using FieldValue.delete()
    db.collection("thresholds").doc("thresholds").set({
        [materialName]: firebase.firestore.FieldValue.delete()
    }, { merge: true })
    .then(() => {
        console.log(`Threshold cleared successfully for ${materialName}`);
        showUpdateMessage('updateMessage3', `Threshold for ${materialName} has been cleared.`);
        initializeThresholdCache();
    })
    .catch((error) => {
        console.error("Error clearing threshold: ", error);
        showUpdateMessage('updateMessage3', `Error clearing threshold: ${error.message}`, true);
    });
}

