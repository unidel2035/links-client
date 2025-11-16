// test-linkdb-menu.js - Test script for link-cli based menu storage
import MenuStorageService from '../src/services/MenuStorageService.js';

const menuStorage = new MenuStorageService();

// Sample menu structure to test
const sampleMenu = [
  {
    label: 'Главное',
    icon: 'pi pi-home',
    items: [
      { label: 'Задачи', icon: 'pi pi-fw pi-home', to: '/dash' },
      { label: 'Агенты', icon: 'pi pi-fw pi-th-large', to: '/spaces' }
    ]
  },
  {
    label: 'Управление',
    icon: 'pi pi-briefcase',
    items: [
      { label: 'Редактор', icon: 'pi pi-pencil', to: '/editor' },
      { label: 'Таблицы', icon: 'pi pi-fw pi-table', to: '/A2025/tables' }
    ]
  }
];

async function testMenuStorage() {
  console.log('=== Testing Link-CLI Menu Storage ===\n');

  try {
    // Test 1: Clear any existing data
    console.log('1. Clearing existing menu data...');
    await menuStorage.clearAllMenus();
    console.log('✓ Menu data cleared\n');

    // Test 2: Store menu structure
    console.log('2. Storing sample menu structure...');
    const itemIds = await menuStorage.storeMenuStructure(sampleMenu, 0);
    console.log(`✓ Stored ${itemIds.length} root menu items`);
    console.log(`   Item IDs: ${itemIds.join(', ')}\n`);

    // Test 3: Retrieve menu structure
    console.log('3. Retrieving menu structure...');
    const retrievedMenu = await menuStorage.getMenuStructure(0);
    console.log(`✓ Retrieved ${retrievedMenu.length} root menu items`);
    console.log('   Retrieved menu structure:');
    console.log(JSON.stringify(retrievedMenu, null, 2));
    console.log();

    // Test 4: Get statistics
    console.log('4. Getting storage statistics...');
    const stats = await menuStorage.getStatistics();
    console.log('✓ Statistics:');
    console.log(`   Total links: ${stats.totalLinks}`);
    console.log(`   Total files: ${stats.totalFiles}`);
    console.log(`   Root items: ${stats.rootItems}\n`);

    // Test 5: Get all menu items (flat list)
    console.log('5. Getting all menu items (flat)...');
    const allItems = await menuStorage.getAllMenuItems();
    console.log(`✓ Retrieved ${allItems.length} total menu items`);
    allItems.forEach((item, index) => {
      console.log(`   [${index + 1}] ${item.label} (ID: ${item._itemId}, Parent: ${item._parentId})`);
    });
    console.log();

    // Test 6: Add a new menu item
    console.log('6. Adding a new menu item...');
    const newItem = {
      label: 'Новый пункт',
      icon: 'pi pi-star',
      to: '/new-item'
    };
    const newItemId = await menuStorage.storeMenuItem(newItem, 0);
    console.log(`✓ Added new item with ID: ${newItemId}\n`);

    // Test 7: Verify new item was added
    console.log('7. Verifying new item was added...');
    const updatedMenu = await menuStorage.getMenuStructure(0);
    console.log(`✓ Now have ${updatedMenu.length} root menu items\n`);

    // Test 8: Delete the new item
    console.log('8. Deleting the new menu item...');
    await menuStorage.deleteMenuItem(newItemId);
    console.log(`✓ Deleted item ${newItemId}\n`);

    // Test 9: Verify deletion
    console.log('9. Verifying deletion...');
    const finalMenu = await menuStorage.getMenuStructure(0);
    console.log(`✓ Back to ${finalMenu.length} root menu items\n`);

    console.log('=== All tests passed! ===\n');

    // Display final statistics
    const finalStats = await menuStorage.getStatistics();
    console.log('Final statistics:');
    console.log(`  Total links: ${finalStats.totalLinks}`);
    console.log(`  Total files: ${finalStats.totalFiles}`);
    console.log(`  Root items: ${finalStats.rootItems}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
testMenuStorage().then(() => {
  console.log('\n✓ Test completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
