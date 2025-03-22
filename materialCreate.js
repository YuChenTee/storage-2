// Function to handle create material form submission
function handleCreateMaterialFormSubmission() {
    document.getElementById('createMaterialForm').addEventListener('submit', function(e) {
        e.preventDefault();

        const materialCode = document.getElementById('createMaterialCode').value.trim();
        const materialName = document.getElementById('createMaterialName').value.trim();
        const materialUnit = document.getElementById('createMaterialUnit').value.trim();

        // Validate input fields
        if (!materialCode || !materialName || !materialUnit) {
            showUpdateMessage('updateMessage2', 'Please provide valid material code, name and unit of measure.', true);
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

// Function to create a new material
function createMaterial(key) {
    console.log(`Creating new material: ${key} with quantity 0...`);

    db.collection('materials').doc('materials').get().then((doc) => {
        const materials = doc.exists ? doc.data() : {};

        // Update materials document using set() with merge
        const updatedMaterials = {
            ...materials,
            [key]: 0
        };

        db.collection('materials').doc('materials').set(updatedMaterials, { merge: true }).then(() => {
            console.log(`Successfully created new material: ${key}`);
            initializeMaterialCacheAndDropdowns(); // Refresh material dropdown
            showUpdateMessage('updateMessage2', `Successfully created new material: ${key}.`);
        }).catch((error) => {
            console.error(`Error creating new material: ${error}`);
            showUpdateMessage('updateMessage2', `Error creating new material: ${error.message}`, true);
        });

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
