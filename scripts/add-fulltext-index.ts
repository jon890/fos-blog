import "dotenv/config";
import mysql from "mysql2/promise";

async function addFulltextIndex() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  const connection = await mysql.createConnection(connectionString);

  try {
    console.log("Adding FULLTEXT index to posts table...");

    // 기존 FULLTEXT 인덱스 확인
    const [indexes] = await connection.execute<mysql.RowDataPacket[]>(
      "SHOW INDEX FROM posts WHERE Index_type = 'FULLTEXT'"
    );

    if (indexes.length > 0) {
      console.log("FULLTEXT index already exists, dropping...");
      await connection.execute("ALTER TABLE posts DROP INDEX ft_search_idx");
    }

    // FULLTEXT 인덱스 생성
    console.log("Creating FULLTEXT index on title, content, description...");
    await connection.execute(
      "ALTER TABLE posts ADD FULLTEXT INDEX ft_search_idx (title, content, description)"
    );

    console.log("FULLTEXT index created successfully!");

    // 인덱스 확인
    const [newIndexes] = await connection.execute<mysql.RowDataPacket[]>(
      "SHOW INDEX FROM posts WHERE Index_type = 'FULLTEXT'"
    );
    console.log(
      "FULLTEXT indexes:",
      newIndexes.map((i) => i.Key_name)
    );
  } catch (error) {
    console.error("Error adding FULLTEXT index:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

addFulltextIndex();
