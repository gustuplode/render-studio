import {Config} from '@remotion/cli/config';
import path from 'path';
// @story = src/videos/<VIDEO> (render.command sets VIDEO)
Config.overrideWebpackConfig((c) => {
  const v = process.env.VIDEO || '01_example';
  return {...c, resolve: {...c.resolve, alias: {...(c.resolve?.alias ?? {}), '@story': path.resolve(process.cwd(), 'src/videos', v)}}};
});
