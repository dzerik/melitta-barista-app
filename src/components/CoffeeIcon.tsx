import imgEspresso from "../assets/recipes/espresso.png";
import imgRistretto from "../assets/recipes/ristretto.png";
import imgLungo from "../assets/recipes/lungo.png";
import imgEspressoDoppio from "../assets/recipes/espresso_doppio.png";
import imgRistrettoDoppio from "../assets/recipes/ristretto_doppio.png";
import imgCafeCreme from "../assets/recipes/cafe_creme.png";
import imgCafeCremeDoppio from "../assets/recipes/cafe_creme_doppio.png";
import imgAmericano from "../assets/recipes/americano.png";
import imgAmericanoExtra from "../assets/recipes/americano_extra_shot2.png";
import imgLongBlack from "../assets/recipes/long_black.png";
import imgRedEye from "../assets/recipes/red_eye.png";
import imgBlackEye from "../assets/recipes/black_eye.png";
import imgDeadEye from "../assets/recipes/dead_eye.png";
import imgCappuccino from "../assets/recipes/cappuccino.png";
import imgEspressoMacchiato from "../assets/recipes/espresso_macchiato.png";
import imgCaffeLatte from "../assets/recipes/caffe_latte.png";
import imgCafeAuLait from "../assets/recipes/cafe_au_lait.png";
import imgFlatWhite from "../assets/recipes/flat_white.png";
import imgLatteMacchiato from "../assets/recipes/latte_macchiato.png";
import imgLatteMacchiatoExtra from "../assets/recipes/latte_macchiato_extra_shot2.png";
import imgLatteMacchiatoTriple from "../assets/recipes/latte_macchiato_triple_shot2.png";
import imgMilk from "../assets/recipes/milk.png";
import imgMilkFroth from "../assets/recipes/milk_froth.png";
import imgWater from "../assets/recipes/water.png";
import imgFreestyle from "../assets/recipes/freestyle_placeholder.png";

const RECIPE_IMAGES: Record<string, string> = {
  Espresso: imgEspresso,
  Ristretto: imgRistretto,
  Lungo: imgLungo,
  "Espresso Doppio": imgEspressoDoppio,
  "Ristretto Doppio": imgRistrettoDoppio,
  "Café Crème": imgCafeCreme,
  "Café Crème Doppio": imgCafeCremeDoppio,
  Americano: imgAmericano,
  "Americano Extra": imgAmericanoExtra,
  "Long Black": imgLongBlack,
  "Red Eye": imgRedEye,
  "Black Eye": imgBlackEye,
  "Dead Eye": imgDeadEye,
  Cappuccino: imgCappuccino,
  "Espresso Macchiato": imgEspressoMacchiato,
  "Caffè Latte": imgCaffeLatte,
  "Café au Lait": imgCafeAuLait,
  "Flat White": imgFlatWhite,
  "Latte Macchiato": imgLatteMacchiato,
  "Latte Macchiato Extra": imgLatteMacchiatoExtra,
  "Latte Macchiato Triple": imgLatteMacchiatoTriple,
  Milk: imgMilk,
  "Milk Froth": imgMilkFroth,
  "Hot Water": imgWater,
};

interface Props {
  recipe: string;
  size?: number;
}

export function CoffeeIcon({ recipe, size = 80 }: Props) {
  const src = RECIPE_IMAGES[recipe] || imgFreestyle;

  return (
    <img
      src={src}
      alt={recipe}
      width={size}
      height={Math.round(size * (720 / 1080))}
      style={{ objectFit: "contain" }}
      draggable={false}
    />
  );
}
