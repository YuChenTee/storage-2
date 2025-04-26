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
async function createMaterial(key) {
    console.log(`Creating new material: ${key} with quantity 0...`);

    try {
        await db.runTransaction(async (transaction) => {
            const materialRef = db.collection('materials').doc('materials');
            const historyRef = db.collection('history').doc(key);

            const materialDoc = await transaction.get(materialRef);
            const materials = materialDoc.exists ? materialDoc.data() : {};

            if (materials.hasOwnProperty(key)) {
                throw new Error(`Material '${key}' already exists.`);
            }

            // Set the new material with quantity 0
            transaction.set(materialRef, {
                [key]: 0
            }, { merge: true });

            // Set an empty history object for the material
            transaction.set(historyRef, {});
        });

        console.log(`Successfully created new material: ${key}`);
        initializeMaterialCacheAndDropdowns(); // Refresh dropdown
        showUpdateMessage('updateMessage2', `Successfully created new material: ${key}.`);
    } catch (error) {
        console.error(`Error creating new material: ${error}`);
        showUpdateMessage('updateMessage2', `Error creating new material: ${error.message}`, true);
    }
}
