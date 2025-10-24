import SchemaHandler from '@noodl-utils/schemahandler';
import { ToastLayer } from '@noodl-views/ToastLayer/ToastLayer';

/**
 * Retry database fetch with exponential backoff
 */
async function retryDatabaseFetch(maxRetries: number = 2): Promise<boolean> {
  const schema = SchemaHandler.instance;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await schema._fetch();
      return true; // Success
    } catch (error) {
      console.error(`Database schema fetch attempt ${attempt + 1}/${maxRetries + 1} failed:`, error);
      
      if (attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt);
        console.log(`Retrying database fetch in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  return false; // All attempts failed
}

export async function extractDatabaseSchema() {
  const schema = SchemaHandler.instance;
  if (typeof schema.haveCloudServices === 'undefined') {
    console.error('Missing database schema');

    const fetchSuccess = await retryDatabaseFetch(2);
    
    if (!fetchSuccess) {
      console.error('Failed to fetch database schema after retries');
      ToastLayer.showError(
        'Failed to load database schema. AI features requiring database access may not work correctly. Please check your database connection.'
      );
      return ''; // Return empty string to signal no schema available
    }
  }

  // Check if we have any collections
  if (!schema.dbCollections || schema.dbCollections.length === 0) {
    console.warn('Database schema loaded but no collections found');
    return '';
  }

  const dbCollectionsSource =
    schema.dbCollections
      .map((collection) => {
        let str = `${collection.name}\n`;
        Object.keys(collection.schema.properties).forEach((name) => {
          const property = collection.schema.properties[name];
          switch (property.type) {
            case 'Pointer': {
              str += `- ${name}:Pointer ${property.targetClass}\n`;
              break;
            }

            case 'Relation': {
              str += `- ${name}:Relation ${property.targetClass}\n`;
              break;
            }

            default: {
              str += `- ${name}:${property.type}\n`;
              break;
            }
          }
        });

        return str;
      })
      .join('\n') + '\n';

  return dbCollectionsSource;
}

export async function extractDatabaseSchemaJSON(): Promise<{ name: string; schema: TSFixme }[]> {
  const schema = SchemaHandler.instance;
  if (typeof schema.haveCloudServices === 'undefined') {
    console.error('Missing database schema');

    const fetchSuccess = await retryDatabaseFetch(2);
    
    if (!fetchSuccess) {
      console.error('Failed to fetch database schema JSON after retries');
      ToastLayer.showError(
        'Failed to load database schema. AI features requiring database access may not work correctly. Please check your database connection.'
      );
      return []; // Return empty array to signal no schema available
    }
  }

  // Check if we have any collections
  if (!schema.dbCollections || Object.keys(schema.dbCollections).length === 0) {
    console.warn('Database schema loaded but no collections found');
    return [];
  }

  return Object.keys(schema.dbCollections).map((key) => schema.dbCollections[key]);
}

export function databaseSchemaCompact(schema: TSFixme): { name: string; compact: string }[] {
  return schema.map((x) => ({
    name: x.name,
    compact: Object.keys(x.schema.properties).join(',')
  }));
}
