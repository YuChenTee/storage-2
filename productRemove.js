// Function to handle product removal form submission
function handleRemoveProductFormSubmission() {
    $('#removeProductForm').on('submit', function(e) {
        e.preventDefault();
        
        const productId = $('#removeProductSelect').val().trim();

        // Confirm before deleting
        confirmAction(`Are you sure you want to remove ${productId}? <span style="color: red; font-weight: bold">This action cannot be undone.</span>`, () => removeProductFromDB(productId));
    });
}

// Function to remove product from Firestore
function removeProductFromDB(productId) {
    if (productId) {
        const batch = db.batch();

        // Reference to the product document in 'products' collection
        const productRef = db.collection('products').doc(productId);
        batch.delete(productRef);

        // Reference to the 'product_list' document
        const productListRef = db.collection('product_list').doc('product_list');

        // Use set() with merge to delete the field safely
        batch.set(productListRef, {
            [productId]: firebase.firestore.FieldValue.delete()
        }, { merge: true });

        batch.commit()
            .then(() => {
                console.log('Product removed successfully from both collections.');
                showUpdateMessage('updateMessage5', `${productId} removed successfully.`);
                initializeProductCacheAndDropdowns(); // Refresh the cached products and dropdowns
            })
            .catch(error => {
                console.error('Error removing product:', error);
                showUpdateMessage('updateMessage5', `Error removing product: ${error.message}`, true);
            });
    } else {
        showUpdateMessage('updateMessage5', 'Please select a product to remove.', true);
    }
}