export default function formatEmail(value) {
  if (value && value.startsWith('mailto:')) {
    return value.substr('mailto:'.length);
  } else {
    return value;
  }
}
