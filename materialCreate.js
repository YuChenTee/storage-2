// Function to handle create material form submission
function handleCreateMaterialFormSubmission() {
    document.getElementById('createMaterialForm').addEventListener('submit', function(e) {
        e.preventDefault();

        const materialCode = document.getElementById('createMaterialCode').value.trim();
        const materialName = document.getElementById('createMaterialName').value.trim();
        const materialUnit = document.getElementById('createMaterialUnit').value.trim();

        // Regular expression to disallow certain characters including '.'
        const invalidCharsRegex = /[~*\/\[\]\.]/;

        // Validate input fields
        if (!materialCode || !materialName || !materialUnit) {
            showUpdateMessage('updateMessage2', 'Please provide valid material code, name and unit of measure.', true);
            return;
        }

        if (invalidCharsRegex.test(materialCode) || invalidCharsRegex.test(materialName)) {
            showUpdateMessage('updateMessage2', 'Material code and name cannot contain ~, *, /, [, ], or .', true);
            return;
        }

        // Combine code and name for storage
        const materialKey = `${materialCode} ${materialName} (${materialUnit})`;

        // Check if the material already exists in the cache
        if (cachedMaterials[materialKey]) {
            showUpdateMessage('updateMessage2', `Material with code ${materialCode} already exists.`, true);
        } else {
            confirmAction(`Are you sure you want to create a new material: ${materialKey}?`, 
                () => createMaterial(materialKey));
        }
    });
}

// // Function to add a new material to the history collection
// function addMaterialToHistory(key, quantity, batchNo, expiryDate) {
//     const currentDateTime = new Date().toISOString(); // Get the current datetime in ISO format
//     expiryDate = new Date(expiryDate).toISOString(); // Convert expiry date to ISO format
    
//     const historyEntry = {
//         [currentDateTime]: {
//             datetime: currentDateTime,
//             in: quantity,
//             out: 0,
//             balance: quantity,
//             batchNo: batchNo,
//             expiryDate: expiryDate
//         }
//     };

//     db.collection('history').doc(key).set(historyEntry, { merge: true }).then(() => {
//         console.log(`Successfully added material to history: ${key}`);
//     }).catch((error) => {
//         console.error(`Error adding material to history: ${error}`);
//         showUpdateMessage('updateMessage2', `Error adding material to history: ${error.message}`, true);
//     });
// }

// Function to create a new material
function createMaterial(key) {
    console.log(`Creating new material: ${key} with quantity 0...`);

    db.collection('materials').doc('materials').get().then((doc) => {
        if (doc.exists) {
            const materials = doc.data();
            const updatedMaterials = {
                ...materials,
                [key]: 0
            };

            db.collection('materials').doc('materials').update(updatedMaterials).then(() => {
                console.log(`Successfully created new material: ${key}`);
                initializeMaterialCacheAndDropdowns(); // Refresh material dropdown
                showUpdateMessage('updateMessage2', `Successfully created new material: ${key}.`);
            }).catch((error) => {
                console.error(`Error creating new material: ${error}`);
                showUpdateMessage('updateMessage2', `Error creating new material: ${error.message}`, true);
            });
        } else {
            // If the document does not exist, create it
            db.collection('materials').doc('materials').set({
                [key]: 0
            }).then(() => {
                console.log(`Successfully created new material: ${key}`);
                initializeMaterialCacheAndDropdowns(); // Refresh material dropdown
                showUpdateMessage('updateMessage2', `Successfully created new material: ${key}.`);
            }).catch((error) => {
                console.error(`Error creating new material: ${error}`);
                showUpdateMessage('updateMessage2', `Error creating new material: ${error.message}`, true);
            });
        }

        // Create an empty history document for the material
        db.collection('history').doc(key).set({}).then(() => {
            console.log(`Created empty history document for material: ${key}`);
        }).catch((error) => {
            console.error(`Error creating history document: ${error}`);
            showUpdateMessage('updateMessage2', `Error creating history document: ${error.message}`, true);
        });
    }).catch((error) => {
        console.error(`Error fetching materials: ${error}`);
        showUpdateMessage('updateMessage2', `Error fetching materials: ${error.message}`, true);
    });
}
