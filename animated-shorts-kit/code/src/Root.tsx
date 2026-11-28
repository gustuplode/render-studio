// Registers the video chosen by the VIDEO env var (render.command asks). Story = src/videos/<VIDEO>/.
import {Composition} from 'remotion';
import {Video, TOTAL} from './engine/render/Video';
export const Root = () => (<>
  <Composition id="Video" component={Video} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
  <Composition id="Preview" component={Video} durationInFrames={TOTAL} fps={30} width={540} height={960} />
</>);
