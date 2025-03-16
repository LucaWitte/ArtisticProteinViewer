/**
 * ShaderChunks.js - Contains shader code chunks used by the application
 * Includes standard vertex and fragment shaders, as well as specialized effects
 */

// Standard vertex shader
export const standardVert = `
uniform float effectStrength;

varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
    // Calculate world position
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    // Calculate view position
    vec4 viewPosition = viewMatrix * worldPosition;
    vViewPosition = viewPosition.xyz;
    
    // Transform normal to world space
    vNormal = normalize(normalMatrix * normal);
    
    // Output position
    gl_Position = projectionMatrix * viewPosition;
}
`;

// Standard fragment shader
export const standardFrag = `
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
uniform float effectStrength;

varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
    // Base material properties
    vec4 diffuseColor = vec4(diffuse, opacity);
    
    // Calculate lighting
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(-vViewPosition);
    
    // Simple lighting model (ambient + diffuse + specular)
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diff = max(dot(normal, lightDir), 0.0);
    vec3 ambient = diffuseColor.rgb * 0.3;
    vec3 diffuseTerm = diffuseColor.rgb * diff * 0.7;
    
    // Specular term
    vec3 halfwayDir = normalize(lightDir + viewDir);
    float specularStrength = 1.0 - roughness;
    float spec = pow(max(dot(normal, halfwayDir), 0.0), 32.0) * specularStrength;
    vec3 specular = vec3(0.3) * spec * (1.0 - metalness) + diffuseColor.rgb * spec * metalness;
    
    // Final color
    vec3 outgoingLight = ambient + diffuseTerm + specular + emissive;
    
    gl_FragColor = vec4(outgoingLight, diffuseColor.a);
}
`;

// Toon vertex shader - adds silhouette outline
export const toonVert = `
uniform float effectStrength;
uniform float outlineWidth;

varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
    // Calculate world position
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    // Transform normal to world space
    vNormal = normalize(normalMatrix * normal);
    
    // Calculate view position
    vec4 viewPosition = viewMatrix * worldPosition;
    vViewPosition = viewPosition.xyz;
    
    // Output position
    gl_Position = projectionMatrix * viewPosition;
}
`;

// Toon/cel-shading fragment shader
export const toonFrag = `
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
uniform float effectStrength;

varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
    // Base material properties
    vec4 diffuseColor = vec4(diffuse, opacity);
    
    // Calculate lighting
    vec3 normal = normalize(vNormal);
    
    // Simple lighting model with cel-shading
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diff = max(dot(normal, lightDir), 0.0);
    
    // Quantize diffuse using steps (controlled by effectStrength)
    float steps = 3.0 + 5.0 * effectStrength;
    diff = floor(diff * steps) / steps;
    
    vec3 ambient = diffuseColor.rgb * 0.3;
    vec3 diffuseTerm = diffuseColor.rgb * diff * 0.7;
    
    // Add an outline based on view angle
    float outline = step(0.3, abs(dot(normalize(-vViewPosition), normal)));
    
    // Final color
    vec3 outgoingLight = ambient + diffuseTerm + emissive;
    outgoingLight = mix(outgoingLight, vec3(0.0), outline);
    
    gl_FragColor = vec4(outgoingLight, diffuseColor.a);
}
`;

// Glow vertex shader
export const glowVert = `
uniform float effectStrength;

varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
    // Calculate world position
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    // Calculate view position
    vec4 viewPosition = viewMatrix * worldPosition;
    vViewPosition = viewPosition.xyz;
    
    // Transform normal to world space
    vNormal = normalize(normalMatrix * normal);
    
    // Output position
    gl_Position = projectionMatrix * viewPosition;
}
`;

// Glow effect fragment shader
export const glowFrag = `
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
uniform float effectStrength;
uniform float glowIntensity;
uniform vec3 glowColor;

varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
    // Base material properties
    vec4 diffuseColor = vec4(diffuse, opacity);
    
    // Calculate lighting
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(-vViewPosition);
    
    // Simple lighting model (ambient + diffuse)
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diff = max(dot(normal, lightDir), 0.0);
    vec3 ambient = diffuseColor.rgb * 0.3;
    vec3 diffuseTerm = diffuseColor.rgb * diff * 0.7;
    
    // Add glow based on view angle (fresnel effect)
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0) * effectStrength;
    vec3 finalGlowColor = (glowColor.rgb == vec3(0.0)) ? emissive : glowColor.rgb;
    vec3 glow = finalGlowColor * fresnel * (0.5 + 4.0 * effectStrength);
    
    // Add pulsating glow effect
    float pulse = 0.5 + 0.5 * sin(vWorldPosition.x * 0.1 + vWorldPosition.y * 0.1 + vWorldPosition.z * 0.1);
    pulse = mix(1.0, pulse, effectStrength * 0.5);
    
    // Final color
    vec3 outgoingLight = ambient + diffuseTerm + emissive + glow * pulse;
    
    gl_FragColor = vec4(outgoingLight, diffuseColor.a);
}
`;

// Outline vertex shader - expands vertices along normals
export const outlineVert = `
uniform float effectStrength;
uniform float outlineWidth;

varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
    // Transform normal to world space
    vNormal = normalize(normalMatrix * normal);
    
    // Expanded position for outline effect
    vec3 expandedPos = position + normal * outlineWidth * effectStrength;
    
    // Calculate world position
    vec4 worldPosition = modelMatrix * vec4(expandedPos, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    // Calculate view position
    vec4 viewPosition = viewMatrix * worldPosition;
    vViewPosition = viewPosition.xyz;
    
    // Output position
    gl_Position = projectionMatrix * viewPosition;
}
`;

// Outline effect fragment shader
export const outlineFrag = `
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
uniform float effectStrength;
uniform vec3 outlineColor;

varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
    // Base material properties
    vec4 diffuseColor = vec4(diffuse, opacity);
    
    // Calculate lighting
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(-vViewPosition);
    
    // Simple lighting model (ambient + diffuse)
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diff = max(dot(normal, lightDir), 0.0);
    vec3 ambient = diffuseColor.rgb * 0.3;
    vec3 diffuseTerm = diffuseColor.rgb * diff * 0.7;
    
    // Calculate outline based on view angle
    float edgeFactor = abs(dot(viewDir, normal));
    float outlineThickness = 0.3 * effectStrength;
    float outline = step(edgeFactor, outlineThickness);
    
    // Final color
    vec3 outgoingLight = ambient + diffuseTerm + emissive;
    outgoingLight = mix(outgoingLight, outlineColor, outline);
    
    gl_FragColor = vec4(outgoingLight, diffuseColor.a);
}
`;

// Utility functions for lighting calculations
export const lightingUtils = `
// Calculate diffuse lighting
float calculateDiffuse(vec3 normal, vec3 lightDir) {
    return max(dot(normal, lightDir), 0.0);
}

// Calculate specular lighting with Blinn-Phong model
float calculateSpecular(vec3 normal, vec3 lightDir, vec3 viewDir, float shininess) {
    vec3 halfwayDir = normalize(lightDir + viewDir);
    return pow(max(dot(normal, halfwayDir), 0.0), shininess);
}

// Calculate Fresnel effect (edge glow)
float calculateFresnel(vec3 normal, vec3 viewDir, float power) {
    return pow(1.0 - max(dot(normal, viewDir), 0.0), power);
}

// Calculate ambient occlusion factor (simplified)
float calculateAO(vec3 position, vec3 normal, sampler2D aoMap) {
    vec2 uv = position.xy * 0.5 + 0.5;
    return texture2D(aoMap, uv).r;
}
`;

// Performance optimized instancing vertex shader
export const instancingVert = `
attribute vec3 instancePosition;
attribute vec4 instanceQuaternion;
attribute vec3 instanceScale;
attribute vec3 instanceColor;

uniform float effectStrength;

varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vColor;

// Function to apply quaternion rotation
vec3 applyQuaternion(vec3 position, vec4 q) {
    vec3 result = position;
    
    vec3 temp = cross(q.xyz, position) * 2.0;
    result += temp * q.w;
    result += cross(q.xyz, temp);
    
    return result;
}

void main() {
    // Apply instance transformations
    vec3 transformed = position * instanceScale;
    transformed = applyQuaternion(transformed, instanceQuaternion);
    transformed += instancePosition;
    
    // Calculate world position
    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    // Calculate view position
    vec4 viewPosition = viewMatrix * worldPosition;
    vViewPosition = viewPosition.xyz;
    
    // Transform normal to world space (simplified for instancing)
    vec3 transformedNormal = applyQuaternion(normal, instanceQuaternion);
    vNormal = normalize(normalMatrix * transformedNormal);
    
    // Pass instance color
    vColor = instanceColor;
    
    // Output position
    gl_Position = projectionMatrix * viewPosition;
}
`;

// Level-of-detail vertex shader for performance
export const lodVert = `
uniform float effectStrength;
uniform float lodLevel;  // 0 = full detail, 1 = lowest detail

varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
    // Calculate world position
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    // Calculate view position
    vec4 viewPosition = viewMatrix * worldPosition;
    vViewPosition = viewPosition.xyz;
    
    // Transform normal to world space
    vNormal = normalize(normalMatrix * normal);
    
    // Simple LOD by quantizing positions based on distance
    float dist = length(vViewPosition);
    float quantizeFactor = mix(0.0, 0.5, lodLevel * smoothstep(10.0, 100.0, dist));
    
    if (quantizeFactor > 0.0) {
        worldPosition.xyz = floor(worldPosition.xyz / quantizeFactor) * quantizeFactor;
        viewPosition = viewMatrix * worldPosition;
    }
    
    // Output position
    gl_Position = projectionMatrix * viewPosition;
}
`;

// SSAO (Screen Space Ambient Occlusion) fragment shader (for post-processing)
export const ssaoFrag = `
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform vec2 resolution;
uniform float radius;
uniform float strength;
uniform float effectStrength;

varying vec2 vUv;

const int samples = 16;
const float bias = 0.025;

void main() {
    vec3 normal = texture2D(tNormal, vUv).rgb * 2.0 - 1.0;
    float depth = texture2D(tDepth, vUv).r;
    
    // Skip SSAO calculation for background
    if (depth > 0.99) {
        gl_FragColor = vec4(1.0);
        return;
    }
    
    // Calculate screen position
    vec3 position = vec3(vUv, depth);
    
    // Random noise for sample positions
    float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
    
    float occlusion = 0.0;
    float actualRadius = radius * (1.0 - depth) * effectStrength;
    
    // Sample neighboring points
    for (int i = 0; i < samples; i++) {
        // Generate hemisphere sample (simplified)
        float angle = noise * 6.283 + float(i) * 0.384;
        float dist = noise * 0.1 + 0.1 + float(i) / float(samples) * 0.9;
        
        vec2 sampleUV = vUv + vec2(cos(angle), sin(angle)) * actualRadius * dist / resolution;
        float sampleDepth = texture2D(tDepth, sampleUV).r;
        
        // Calculate occlusion factor
        float rangeCheck = smoothstep(0.0, 1.0, actualRadius / abs(depth - sampleDepth));
        occlusion += (sampleDepth <= depth - bias ? 1.0 : 0.0) * rangeCheck;
    }
    
    occlusion = 1.0 - (occlusion / float(samples)) * strength * effectStrength;
    
    gl_FragColor = vec4(occlusion, occlusion, occlusion, 1.0);
}
`;

// Environment mapping for shiny materials
export const envMapFrag = `
uniform vec3 diffuse;
uniform float roughness;
uniform float metalness;
uniform float opacity;
uniform float effectStrength;
uniform samplerCube envMap;

varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
    // Base material properties
    vec4 diffuseColor = vec4(diffuse, opacity);
    
    // Calculate lighting
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(-vViewPosition);
    
    // Simple lighting model (ambient + diffuse)
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diff = max(dot(normal, lightDir), 0.0);
    vec3 ambient = diffuseColor.rgb * 0.3;
    vec3 diffuseTerm = diffuseColor.rgb * diff * 0.7;
    
    // Environment mapping
    vec3 reflectionDir = reflect(viewDir, normal);
    vec3 worldReflect = normalize(mat3(viewMatrix) * reflectionDir);
    vec4 envColor = textureCube(envMap, worldReflect);
    
    // Apply roughness (simplified)
    float envInfluence = mix(0.0, 1.0, metalness) * (1.0 - roughness) * effectStrength;
    
    // Final color
    vec3 outgoingLight = ambient + diffuseTerm + envColor.rgb * envInfluence;
    
    gl_FragColor = vec4(outgoingLight, diffuseColor.a);
}
`;

// Helper function to transform a normal into tangent space
export const normalMapUtils = `
// Transform normal from tangent to world space
vec3 perturbNormal2Arb(vec3 eye_pos, vec3 surf_norm, vec3 mapN, float faceDirection) {
    vec3 q0 = dFdx(eye_pos.xyz);
    vec3 q1 = dFdy(eye_pos.xyz);
    vec2 st0 = dFdx(vUv.st);
    vec2 st1 = dFdy(vUv.st);
    
    vec3 S = normalize(q0 * st1.t - q1 * st0.t);
    vec3 T = normalize(-q0 * st1.s + q1 * st0.s);
    vec3 N = normalize(surf_norm);
    
    float det = max(dot(S, T), 0.0);
    float scale = (det == 0.0) ? 0.0 : faceDirection / sqrt(det);
    
    return normalize(scale * (S * mapN.x + T * mapN.y) + N * mapN.z);
}
`;
