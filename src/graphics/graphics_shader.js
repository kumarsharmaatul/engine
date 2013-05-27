pc.extend(pc.gfx, function () {

    function createShader(gl, type, src) {
        var shader = gl.createShader(type);

        // Compile the shader
        gl.shaderSource(shader, src);
        gl.compileShader(shader);

        var ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        if (!ok) {
            var error = gl.getShaderInfoLog(shader);
            var typeName = (type === gl.VERTEX_SHADER) ? "vertex" : "fragment";
            logERROR("Failed to compile " + typeName + " shader:\n" + src + "\n" + error);
        }

        return shader;
    }

    function createProgram(gl, vertexShader, fragmentShader) {
        var program = gl.createProgram();

        // Link together the vertex and fragment shaders
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        var ok = gl.getProgramParameter(program, gl.LINK_STATUS);
        if (!ok) {
            var error = gl.getProgramInfoLog(program);
            logERROR("Failed to link shader program. Error: " + error);
        }

        return program;
    }

    /**
     * @name pc.gfx.Shader
     * @class A shader is a program that is repsonsible for rendering graphical primitives on a device's
     * graphics processor.
     * @description Creates a new shader object. The shader is generated from a shader definition. This 
     * shader definition specifies the code for processing vertices and fragments processed by the GPU.
     * The language of the code is GLSL (otherwise known as ESSL, the OpenGL ES Shading Language). The
     * shader definition also describes how the PlayCanvas engine should map vertex buffer elements onto
     * the attributes specified in the vertex shader code.
     * @param {pc.gfx.Device} graphicsDevice The graphics device used to manage this shader.
     * @param {Object} definition The shader definition from which to build the shader.
     * @param {Object} definition.attributes Object detailing the mapping of vertex shader attribute names to semantics (pc.gfx.SEMANTIC_*).
     * @param {String} definition.vshader Vertex shader source (GLSL code).
     * @param {String} definition.fshader Fragment shader source (GLSL code).
     * @example 
     * // Create a shader that renders primitives with a solid red color
     * var shaderDefinition = {
     *     attributes: {
     *         aPosition: pc.gfx.SEMANTIC_POSITION
     *     },
     *     vshader: [
     *         "attribute vec3 aPosition;",
     *         "",
     *         "void main(void)",
     *         "{",
     *         "    gl_Position = vec4(aPosition, 1.0);",
     *         "}"
     *     ].join("\n"),
     *     fshader: [
     *         "precision mediump float;",
     *         "",
     *         "void main(void)",
     *         "{",
     *         "    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);",
     *         "}"
     *     ].join("\n")
     * };
     * 
     * shader = new pc.gfx.Shader(graphicsDevice, shaderDefinition);
     * @author Will Eastcott
     */
    var Shader = function (graphicsDevice, definition) {
        this.device = graphicsDevice;
        this.definition = definition;

        var gl = this.device.gl;
        this.vertexShader = createShader(gl, gl.VERTEX_SHADER, definition.vshader);
        this.fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, definition.fshader);
        this.program = createProgram(gl, this.vertexShader, this.fragmentShader);
        this.attributes = [];
        this.uniforms = [];
        this.samplers = [];

        // Query the program for each vertex buffer input (GLSL 'attribute')
        var i = 0;
        var info, location;

        var _typeToPc = {};
        _typeToPc[gl.BOOL]         = pc.gfx.ShaderInputType.BOOL;
        _typeToPc[gl.INT]          = pc.gfx.ShaderInputType.INT;
        _typeToPc[gl.FLOAT]        = pc.gfx.ShaderInputType.FLOAT;
        _typeToPc[gl.FLOAT_VEC2]   = pc.gfx.ShaderInputType.VEC2;
        _typeToPc[gl.FLOAT_VEC3]   = pc.gfx.ShaderInputType.VEC3;
        _typeToPc[gl.FLOAT_VEC4]   = pc.gfx.ShaderInputType.VEC4;
        _typeToPc[gl.INT_VEC2]     = pc.gfx.ShaderInputType.IVEC2;
        _typeToPc[gl.INT_VEC3]     = pc.gfx.ShaderInputType.IVEC3;
        _typeToPc[gl.INT_VEC4]     = pc.gfx.ShaderInputType.IVEC4;
        _typeToPc[gl.BOOL_VEC2]    = pc.gfx.ShaderInputType.BVEC2;
        _typeToPc[gl.BOOL_VEC3]    = pc.gfx.ShaderInputType.BVEC3;
        _typeToPc[gl.BOOL_VEC4]    = pc.gfx.ShaderInputType.BVEC4;
        _typeToPc[gl.FLOAT_MAT2]   = pc.gfx.ShaderInputType.MAT2;
        _typeToPc[gl.FLOAT_MAT3]   = pc.gfx.ShaderInputType.MAT3;
        _typeToPc[gl.FLOAT_MAT4]   = pc.gfx.ShaderInputType.MAT4;
        _typeToPc[gl.SAMPLER_2D]   = pc.gfx.ShaderInputType.TEXTURE2D;
        _typeToPc[gl.SAMPLER_CUBE] = pc.gfx.ShaderInputType.TEXTURECUBE;

        var numAttributes = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
        while (i < numAttributes) {
            info = gl.getActiveAttrib(this.program, i++);
            location = gl.getAttribLocation(this.program, info.name);
            var attr = new pc.gfx.ShaderInput(graphicsDevice, definition.attributes[info.name], _typeToPc[info.type], location);
            this.attributes.push(attr);
        }

        // Query the program for each shader state (GLSL 'uniform')
        i = 0;
        var numUniforms = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
        while (i < numUniforms) {
            info = gl.getActiveUniform(this.program, i++);
            location = gl.getUniformLocation(this.program, info.name);
            if ((info.type === gl.SAMPLER_2D) || (info.type === gl.SAMPLER_CUBE)) {
                this.samplers.push(new pc.gfx.ShaderInput(graphicsDevice, info.name, _typeToPc[info.type], location));
            } else {
                this.uniforms.push(new pc.gfx.ShaderInput(graphicsDevice, info.name, _typeToPc[info.type], location));
            }
        }
    };

    Shader.prototype = {
        /**
         * @function
         * @name pc.gfx.Shader#destroy
         * @description Frees resources associated with this shader.
         * @author Will Eastcott
         */
        destroy: function () {
            var gl = this.device.gl;
            gl.deleteShader(this.vertexShader);
            gl.deleteShader(this.fragmentShader);
            gl.deleteProgram(this.program);
        }
    };

    return {
        Shader: Shader
    }; 
}());