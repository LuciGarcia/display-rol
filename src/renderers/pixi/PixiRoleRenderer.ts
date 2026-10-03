import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { RoleInstance } from "../../domain/roles/role";
import type { SlotLayout } from "../../engine/layout/types";

export class PixiRoleRenderer {
  public static renderRole(role: RoleInstance, slot: SlotLayout): Container {
    const container = new Container();
    const radius = 16;
    container.x = slot.x + slot.width / 2;
    container.y = slot.y + radius + 2;

    const avatar = new Graphics();

    avatar.circle(0, 0, radius);
    avatar.fill({ color: 0x2ecc71 }); // Verde brillante
    avatar.stroke({ color: 0x27ae60, width: 2 });
    container.addChild(avatar);

    const initial = role.name.charAt(0).toUpperCase();
    const style = new TextStyle({
      fontSize: 14,
      fill: "#ffffff",
      fontWeight: "bold",
      fontFamily: "Arial",
    });

    const letter = new Text({ text: initial, style });
    letter.anchor.set(0.5);
    letter.x = 0;
    letter.y = 0;
    container.addChild(letter);

    const nameStyle = new TextStyle({
      fontSize: 11,
      fill: "#2c3e50",
      fontWeight: "bold",
      fontFamily: "Arial",
    });
    const nameLabel = new Text({ text: role.name, style: nameStyle });
    nameLabel.anchor.set(0.5, 0);
    nameLabel.x = 0;
    nameLabel.y = radius + 4;
    container.addChild(nameLabel);

    return container;
  }
}
