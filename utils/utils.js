
/**
 * Takes a string as an argument and capitalizes it
 * Converts first character to upper case.
 * 
 * Used maily by Graphql compiler to name
 * Types, Queries and Mutations.
 */
exports.capitalize = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
