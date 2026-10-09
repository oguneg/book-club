import { Redirect } from 'expo-router';

/** The shelf moved into My books (Read); old links land there. */
export default function Shelf() {
  return <Redirect href={{ pathname: '/', params: { show: 'read' } }} />;
}
