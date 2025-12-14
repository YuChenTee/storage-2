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
async function removeProductFromDB(productId) {
    console.log('Starting product removal for:', productId);
    
    if (productId) {
        // Ensure sales orders are loaded
        if (Object.keys(cachedSalesOrders).length === 0) {
            console.log('Sales orders not cached, fetching...');
            await fetchSalesOrdersFromDB();
        }
        
        console.log('Checking sales orders...', cachedSalesOrders);

        // Check if product is used in any sales orders
        for (const orderId in cachedSalesOrders) {
            const order = cachedSalesOrders[orderId];
            if (order.products && Array.isArray(order.products)) {
                const isProductInOrder = order.products.some(p => p.product === productId);
                if (isProductInOrder) {
                    console.log('Product found in order:', orderId);
                    // Close the confirmation modal
                    const modal = document.getElementById('customConfirmModal');
                    if (modal) modal.style.display = 'none';
                    showUpdateMessage('updateMessage12', `Cannot remove ${productId}. It is used in sales order ${orderId}.`, true);
                    return;
                }
            }
        }
        
        console.log('Product not in any sales orders, proceeding with deletion...');

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
                showUpdateMessage('updateMessage12', `${productId} removed successfully.`);
                initializeProductCacheAndDropdowns(); // Refresh the cached products and dropdowns
            })
            .catch(error => {
                console.error('Error removing product:', error);
                showUpdateMessage('updateMessage12', `Error removing product: ${error.message}`, true);
            });
    } else {
        showUpdateMessage('updateMessage12', 'Please select a product to remove.', true);
    }
}