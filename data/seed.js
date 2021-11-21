const dbConnection = require('../config/mongoConnection');
const users = require('./users');

async function main() {
    const db = await dbConnection();
    // await db.dropDatabase();
    // await users.createUser(
    //     'John', 
    //     '678 Garden St', 
    //     'Hoboken', 
    //     'New Jersey', 
    //     '07030', 
    //     'jdoe99@gmail.com', 
    //     '111-222-3333', 
    //     [], [], 
    //     {"likes":[], "dislikes":[]}, 
    //     '0123456789'
    //     );

    // const anthenticated = await users.checkUser("John", '0123456789');
    // console.log(anthenticated);
    const updated = await users.updateUserProfile(
        '619ad9bd78f651e6285580d1',
        'John', 
        '678 Garden St', 
        'Hoboken', 
        'New York', 
        '07036', 
        'jdoe99@gmail.com', 
        '111-222-4444',
        []
        );
    console.log(updated);
    console.log('Done seeding database');
    await db.serverConfig.close();
}

main();