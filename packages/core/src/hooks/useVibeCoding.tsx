import { useMemo } from "react";

export function useVibeCoding(schema: any) {
  const SceneComponents = useMemo(() => {
    if (!schema.objects) return null;
    return schema.objects.map((obj: any) => {
      if (obj.type === "sphere") {
        return (
          <mesh key={obj.id} scale={obj.scale}>
            <sphereGeometry args={[1, 32, 32]} />
            <meshStandardMaterial color={obj.color} />
          </mesh>
        );
      }
      return null;
    });
  }, [schema]);

  return {
    SceneComponents,
    canvasConfig: schema.canvas || {}
  };
}