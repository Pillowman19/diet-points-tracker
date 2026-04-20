import { notFound } from 'next/navigation';
import TrackerClient from './TrackerClient';

export default async function TrackerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug !== process.env.APP_SECRET) {
    notFound();
  }
  return <TrackerClient secret={slug} />;
}
