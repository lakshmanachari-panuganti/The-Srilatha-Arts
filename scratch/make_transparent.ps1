Add-Type -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;

public class ImageProcessor {
    public static void MakeTransparent(string inputPath, string outputPath, int threshold) {
        using (Bitmap bmp = new Bitmap(inputPath)) {
            using (Bitmap target = new Bitmap(bmp.Width, bmp.Height)) {
                for (int x = 0; x < bmp.Width; x++) {
                    for (int y = 0; y < bmp.Height; y++) {
                        Color c = bmp.GetPixel(x, y);
                        // If it's very close to black, make it transparent
                        if (c.R < threshold && c.G < threshold && c.B < threshold) {
                            target.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0));
                        } else {
                            target.SetPixel(x, y, c);
                        }
                    }
                }
                target.Save(outputPath, ImageFormat.Png);
            }
        }
    }
}
"@ -ReferencedAssemblies System.Drawing

[ImageProcessor]::MakeTransparent('C:\repos\The-Srilatha-Arts\frontend\public\images\Logos\logo.jpeg', 'C:\repos\The-Srilatha-Arts\frontend\public\images\Logos\logo.png', 45)
Write-Host "Logo converted successfully!"
