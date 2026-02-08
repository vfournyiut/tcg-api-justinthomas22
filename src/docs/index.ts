import YAML from 'yamljs'
import path from 'path'

/**
 * Fusionner la configuration OpenAPI Swagger
 * Cette fonction charge et fusionne tous les fichiers YAML de documentation
 * pour créer un document OpenAPI complet
 */

// Charger la configuration principale
const swaggerConfig = YAML.load(path.join(__dirname, 'swagger.config.yml'))

// Charger les documentations des modules
const authDoc = YAML.load(path.join(__dirname, 'auth.doc.yml'))
const cardsDoc = YAML.load(path.join(__dirname, 'cards.doc.yml'))
const decksDoc = YAML.load(path.join(__dirname, 'decks.doc.yml'))

/**
 * Document Swagger/OpenAPI complet
 * Fusionné à partir de la configuration principale et de tous les modules
 * 
 * @type {Object} - Objet conforme à la spécification OpenAPI 3.0.0
 */
export const swaggerDocument = {
    ...swaggerConfig,
    paths: {
        ...authDoc.paths,
        ...cardsDoc.paths,
        ...decksDoc.paths
    }
}
