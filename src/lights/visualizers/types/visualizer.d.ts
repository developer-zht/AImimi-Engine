// 注册函数类型
type VisualizerFactory = (gl: WebGLRenderingContext, light: ILight) => Promise<MeshRenderer>
