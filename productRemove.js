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
        // Remove from 'products' collection
        db.collection('products').doc(productId).delete()
            .then(() => {
                console.log('Product removed successfully from the products collection.');

                // Remove from 'product_list' collection
                db.collection('product_list').doc('product_list').update({
                    [productId]: firebase.firestore.FieldValue.delete()
                })
                .then(() => {
                    console.log('Product removed successfully from the product_list collection.');
                    showUpdateMessage('updateMessage5', `${productId} removed successfully.`);
                    initializeProductCacheAndDropdowns(); // Refresh the cached products and dropdowns
                })
                .catch(error => {
                    console.error('Error removing product from product_list collection:', error);
                });
            })
            .catch(error => {
                console.error('Error removing product from products collection:', error);
            });
    } else {
        showUpdateMessage('updateMessage5', 'Please select a product to remove.', true);
    }
}