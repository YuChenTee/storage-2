async function restoreBackup(backupId) {
    const collectionsToRestore = [
        'buffer', 'history', 'materials', 'numOfDays', 
        'orders', 'product_list', 'products', 'salesOrder', 'thresholds'
    ];

    try {
        for (const collection of collectionsToRestore) {
            const backupCollectionName = `${collection}_backup_${backupId}`;
            const targetCollectionName = collection;

            console.log(`Restoring ${backupCollectionName} to ${targetCollectionName}...`);

            // Step 1: Delete current data in target collection
            await deleteCollection(targetCollectionName);

            // Step 2: Copy data from backup to original
            await duplicateCollection(backupCollectionName, targetCollectionName);
        }

        console.log(`✅ Successfully restored all collections from backup ID: ${backupId}`);
    } catch (error) {
        console.error(`❌ Error restoring backup ${backupId}:`, error);
    }
}

async function renameMaterialName(oldName, newName) {
    try {

        // === 2. history.collection('history').doc(oldName) ===
        const oldHistoryRef = db.collection('history').doc(oldName);
        const newHistoryRef = db.collection('history').doc(newName);
        const oldHistorySnap = await oldHistoryRef.get();
        if (oldHistorySnap.exists) {
            await newHistoryRef.set(oldHistorySnap.data());
            await oldHistoryRef.delete();
        }

        // === 3. materials.collection('materials').doc('materials') ===
        const materialsRef = db.collection('materials').doc('materials');
        const materialsSnap = await materialsRef.get();
        if (materialsSnap.exists && materialsSnap.data()[oldName] !== undefined) {
            const materialsData = materialsSnap.data();
            materialsData[newName] = materialsData[oldName];
            delete materialsData[oldName];
            await materialsRef.set(materialsData);
        }

        // === 4. orders.collection('orders').doc('orders') ===
        const ordersRef = db.collection('orders').doc('orders');
        const ordersSnap = await ordersRef.get();
        if (ordersSnap.exists) {
            const ordersData = ordersSnap.data();
            for (const orderId in ordersData) {
                if (ordersData[orderId].materialKey === oldName) {
                    ordersData[orderId].materialKey = newName;
                }
            }
            await ordersRef.set(ordersData);
        }

        // === 5. products.collection('products').doc(*) ===
        const productsSnap = await db.collection('products').get();
        for (const doc of productsSnap.docs) {
            const productData = doc.data();
            if (productData[oldName] !== undefined) {
                const newProductData = { ...productData };
                newProductData[newName] = newProductData[oldName];
                delete newProductData[oldName];
                await db.collection('products').doc(doc.id).set(newProductData);
            }
        }

        // === 6. thresholds.collection('thresholds').doc('thresholds') ===
        const thresholdsRef = db.collection('thresholds').doc('thresholds');
        const thresholdsSnap = await thresholdsRef.get();
        if (thresholdsSnap.exists && thresholdsSnap.data()[oldName] !== undefined) {
            const thresholdsData = thresholdsSnap.data();
            thresholdsData[newName] = thresholdsData[oldName];
            delete thresholdsData[oldName];
            await thresholdsRef.set(thresholdsData);
        }

        console.log(`✅ Successfully renamed "${oldName}" to "${newName}" across all relevant collections.`);
    } catch (error) {
        console.error(`❌ Error renaming material:`, error);
    }
}