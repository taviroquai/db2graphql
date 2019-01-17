
/**
 * Takes a string as an argument and capitalizes it
 * Converts first character to upper case.
 * 
 * Used maily by Graphql compiler to name
 * Types, Queries and Mutations.
 */
const capitalize = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

const toCamelCase = (string) => {
  return string.split('_').map(i => capitalize(i)).join('');
}

exports.capitalize = capitalize;
exports.toCamelCase = toCamelCase;
