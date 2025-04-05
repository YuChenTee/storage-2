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

